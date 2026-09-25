/**
 * The wire: a glass news-and-social panel over the world.
 *
 *   renderWire(host, view, options?)   mount once, then call again with new views
 *   disposeWire(host)                  tear down timers, observers and DOM
 *
 * Updates are keyed: a card that was on screen keeps its <article> element, so
 * focus, the reader's scroll position, hover and read state survive. When the
 * reader is at the top, new cards slide in and older ones glide down; when the
 * reader has scrolled away, their place is held and a "new" pill appears.
 */
import { icon, wireBrand } from "./brand-bridge.ts";
import { quietWire } from "./thumbs.ts";
import { cardSignature, fillCard, type CardContext } from "./cards.ts";
import { formatCount } from "./details.ts";
import { reconcileKeyed } from "./keyed.ts";
import {
  buildWireEntries,
  representedCount,
  type WireEntry,
} from "./saturation.ts";
import { disposeTicker, renderTicker } from "./ticker.ts";
import type { WireRenderOptions, WireView } from "./types.ts";

export type WireFilter = "all" | "press" | "posts";

const FILTERS: { id: WireFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "press", label: "Press" },
  { id: "posts", label: "Posts" },
];

const BANNER_MS = 9000;
const READ_DWELL_MS = 1100;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

interface WireState {
  host: HTMLElement;
  root: HTMLElement;
  countEl: HTMLElement;
  newEl: HTMLElement;
  updatedEl: HTMLElement;
  segButtons: Map<WireFilter, HTMLButtonElement>;
  segCounts: Map<WireFilter, HTMLElement>;
  factoid: HTMLElement;
  factoidText: HTMLElement;
  factoidValue: string | null;
  scroller: HTMLElement;
  feed: HTMLElement;
  empty: HTMLElement;
  bannerSlot: HTMLElement;
  bannerTimer: number;
  pill: HTMLButtonElement;
  pillCount: number;
  footer: HTMLElement;
  tickerMount: HTMLElement | null;
  nodes: Map<string, HTMLElement>;
  sigs: Map<string, string>;
  entries: Map<string, WireEntry>;
  read: Set<string>;
  /** Every member id ever rendered, for counting arrivals. */
  seen: Set<string>;
  bannered: Set<string>;
  first: boolean;
  filter: WireFilter;
  /** Roving tabindex: the one card in the tab order. */
  current: string | null;
  io: IntersectionObserver | null;
  readTimers: Map<string, number>;
  pendingRead: string[];
  flushQueued: boolean;
  options: WireRenderOptions;
  view: WireView | null;
  ctx: CardContext;
  reduced: boolean;
  cleanup: (() => void)[];
}

const states = new WeakMap<HTMLElement, WireState>();
let instances = 0;

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = "",
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function prefersReduced(): boolean {
  try {
    return (
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

function matchesFilter(entry: WireEntry, filter: WireFilter): boolean {
  if (filter === "all") return true;
  return filter === "posts"
    ? entry.item.kind === "post"
    : entry.item.kind !== "post";
}

function isUnread(st: WireState, entry: WireEntry): boolean {
  return entry.members.some((id) => !st.read.has(id));
}

/* ------------------------------------------------------------- mount */

function mount(host: HTMLElement, options: WireRenderOptions): WireState {
  const idPrefix = `wr${(++instances).toString(36)}`;
  const root = h("section", "wr");
  root.setAttribute("aria-labelledby", `${idPrefix}-title`);

  // Header -----------------------------------------------------------
  const head = h("header", "wr-head");
  const row = h("div", "wr-head-row");
  const title = h("h2", "wr-title", "The wire");
  title.id = `${idPrefix}-title`;
  const live = h("span", "wr-live");
  const dot = h("span", "wr-live-dot");
  dot.setAttribute("aria-hidden", "true");
  live.append(dot, h("span", "wr-live-t", "Live"));
  const count = h("span", "wr-count");
  const countEl = h("span", "wr-count-n", "0");
  const newEl = h("span", "wr-count-new");
  count.append(countEl, newEl);
  row.append(title, live, h("span", "wr-fill"), count);
  const updatedEl = h("p", "wr-updated");
  const seg = h("div", "wr-seg");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Show");
  const segButtons = new Map<WireFilter, HTMLButtonElement>();
  const segCounts = new Map<WireFilter, HTMLElement>();
  for (const f of FILTERS) {
    const b = h("button", "wr-seg-b");
    b.type = "button";
    b.dataset.filter = f.id;
    const n = h("span", "wr-seg-n", "0");
    b.append(h("span", "wr-seg-t", f.label), n);
    segButtons.set(f.id, b);
    segCounts.set(f.id, n);
    seg.append(b);
  }
  head.append(row, updatedEl, seg);

  // Factoid ----------------------------------------------------------
  const factoid = h("div", "wr-factoid");
  factoid.hidden = true;
  const fk = h("span", "wr-factoid-k", "Figure");
  const factoidText = h("p", "wr-factoid-t");
  factoid.append(fk, factoidText);

  // Stage: banner + pill overlays, the scroller, the feed -------------
  const stageEl = h("div", "wr-stage");
  const bannerSlot = h("div", "wr-banner-slot");
  bannerSlot.setAttribute("aria-live", "polite");
  bannerSlot.setAttribute("aria-atomic", "true");
  const pill = h("button", "wr-pill");
  pill.type = "button";
  pill.hidden = true;
  const scroller = h("div", "wr-scroll");
  const feed = h("div", "wr-feed");
  feed.setAttribute("role", "feed");
  feed.setAttribute("aria-labelledby", `${idPrefix}-title`);
  const empty = h("div", "wr-empty");
  scroller.append(feed, empty);
  stageEl.append(scroller, pill);

  const footer = h("footer", "wr-foot");

  // The breaking banner sits in flow between the header and the feed, so it
  // never covers a card; it opens and closes like a drawer.
  root.append(head, factoid, bannerSlot, stageEl, footer);
  host.append(root);

  const st: WireState = {
    host,
    root,
    countEl,
    newEl,
    updatedEl,
    segButtons,
    segCounts,
    factoid,
    factoidText,
    factoidValue: null,
    scroller,
    feed,
    empty,
    bannerSlot,
    bannerTimer: 0,
    pill,
    pillCount: 0,
    footer,
    tickerMount: null,
    nodes: new Map(),
    sigs: new Map(),
    entries: new Map(),
    read: new Set(),
    seen: new Set(),
    bannered: new Set(),
    first: true,
    filter: "all",
    current: null,
    io: null,
    readTimers: new Map(),
    pendingRead: [],
    flushQueued: false,
    options,
    view: null,
    ctx: { today: null, botSaturation: 0, idPrefix },
    reduced: false,
    cleanup: [],
  };

  // Events -----------------------------------------------------------
  const on = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
  ) => {
    target.addEventListener(type, fn as EventListener);
    st.cleanup.push(() =>
      target.removeEventListener(type, fn as EventListener),
    );
  };

  on(seg, "click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".wr-seg-b");
    if (!b) return;
    st.filter = (b.dataset.filter as WireFilter) || "all";
    applyVisibility(st);
    st.scroller.scrollTop = 0;
  });

  on(feed, "click", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>(".wr-card");
    if (card && card.parentElement === feed) activate(st, card);
  });
  on(feed, "keydown", (e) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains("wr-card") || target.parentElement !== feed)
      return;
    const visible = [...feed.children].filter(
      (n) => !(n as HTMLElement).hidden,
    ) as HTMLElement[];
    const i = visible.indexOf(target);
    let next: HTMLElement | undefined;
    switch (e.key) {
      case "ArrowDown":
      case "PageDown":
      case "j":
        next = visible[i + 1];
        break;
      case "ArrowUp":
      case "PageUp":
      case "k":
        next = visible[i - 1];
        break;
      case "Home":
        next = visible[0];
        break;
      case "End":
        next = visible[visible.length - 1];
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        activate(st, target);
        return;
      case "Escape":
        if (target.dataset.open === "true") {
          target.dataset.open = "false";
          e.preventDefault();
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    if (next) next.focus();
  });
  on(feed, "focusin", (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>(".wr-card");
    if (!card?.dataset.key) return;
    if (st.current !== card.dataset.key) {
      const prev = st.current ? st.nodes.get(st.current) : undefined;
      if (prev) prev.tabIndex = -1;
      for (const node of st.feed.children as HTMLCollectionOf<HTMLElement>)
        if (node.tabIndex === 0 && node !== card) node.tabIndex = -1;
      card.tabIndex = 0;
      st.current = card.dataset.key;
    }
    markRead(st, card.dataset.key);
  });
  on(scroller, "scroll", () => {
    if (scroller.scrollTop <= 4 && !pill.hidden) hidePill(st);
  });
  on(pill, "click", () => {
    scroller.scrollTo({ top: 0, behavior: st.reduced ? "auto" : "smooth" });
    hidePill(st);
    const first = [...feed.children].find((n) => !(n as HTMLElement).hidden) as
      HTMLElement | undefined;
    first?.focus({ preventScroll: true });
  });

  if (typeof IntersectionObserver !== "undefined") {
    st.io = new IntersectionObserver(
      (records) => {
        for (const r of records) {
          const key = (r.target as HTMLElement).dataset.key;
          if (!key) continue;
          if (r.isIntersecting && r.intersectionRatio >= 0.6) {
            if (!st.readTimers.has(key))
              st.readTimers.set(
                key,
                window.setTimeout(() => {
                  st.readTimers.delete(key);
                  markRead(st, key);
                }, READ_DWELL_MS),
              );
          } else {
            const t = st.readTimers.get(key);
            if (t !== undefined) clearTimeout(t);
            st.readTimers.delete(key);
          }
        }
      },
      { root: scroller, threshold: [0, 0.6, 1] },
    );
  }

  states.set(host, st);
  return st;
}

/* ------------------------------------------------------------- behaviour */

function activate(st: WireState, card: HTMLElement) {
  const key = card.dataset.key;
  if (!key) return;
  const open = card.dataset.open === "true";
  card.dataset.open = open ? "false" : "true";
  markRead(st, key);
  const entry = st.entries.get(key);
  if (entry) st.options.onOpen?.(entry.item);
}

function markRead(st: WireState, key: string) {
  const entry = st.entries.get(key);
  if (!entry) return;
  const fresh = entry.members.filter((id) => !st.read.has(id));
  if (!fresh.length) return;
  for (const id of fresh) st.read.add(id);
  const node = st.nodes.get(key);
  if (node) node.dataset.read = "true";
  st.pendingRead.push(...fresh);
  updateCounts(st);
  if (!st.flushQueued) {
    st.flushQueued = true;
    queueMicrotask(() => {
      st.flushQueued = false;
      const ids = st.pendingRead.splice(0);
      if (ids.length) st.options.onRead?.(ids);
    });
  }
}

function hidePill(st: WireState) {
  st.pill.hidden = true;
  st.pillCount = 0;
}

function showPill(st: WireState, added: number) {
  st.pillCount += added;
  st.pill.replaceChildren(icon("up", 12), h("span", "", `${st.pillCount} new`));
  st.pill.setAttribute(
    "aria-label",
    `${st.pillCount} new ${st.pillCount === 1 ? "item" : "items"}. Jump to newest.`,
  );
  const wasHidden = st.pill.hidden;
  st.pill.hidden = false;
  if (wasHidden && !st.reduced && typeof st.pill.animate === "function")
    st.pill.animate(
      [
        { opacity: 0, transform: "translate(-50%, -6px)" },
        { opacity: 1, transform: "translate(-50%, 0)" },
      ],
      { duration: 260, easing: EASE },
    );
}

function applyVisibility(st: WireState) {
  const visible: HTMLElement[] = [];
  for (const node of st.feed.children as HTMLCollectionOf<HTMLElement>) {
    const entry = node.dataset.key
      ? st.entries.get(node.dataset.key)
      : undefined;
    const show = entry ? matchesFilter(entry, st.filter) : false;
    node.hidden = !show;
    if (show) visible.push(node);
  }
  const current =
    visible.find((n) => n.dataset.key === st.current) ?? visible[0];
  for (const node of st.feed.children as HTMLCollectionOf<HTMLElement>)
    node.tabIndex = node === current ? 0 : -1;
  visible.forEach((node, i) => {
    node.setAttribute("aria-posinset", String(i + 1));
    node.setAttribute("aria-setsize", String(visible.length));
  });
  for (const [id, b] of st.segButtons)
    b.setAttribute("aria-pressed", String(id === st.filter));
  const hasAny = st.entries.size > 0;
  st.empty.hidden = visible.length > 0;
  st.empty.replaceChildren(
    ...(hasAny ? [] : [quietWire(132)]),
    h(
      "p",
      "wr-empty-t",
      hasAny
        ? st.filter === "posts"
          ? "No posts yet."
          : "No reports yet."
        : "The wire is quiet.",
    ),
    h(
      "p",
      "wr-empty-s",
      hasAny
        ? "Switch to All to see everything filed."
        : "Reports will appear here as the world responds.",
    ),
  );
}

function updateCounts(st: WireState) {
  const entries = [...st.entries.values()];
  const total = representedCount(entries);
  st.countEl.textContent = formatCount(total);
  const unread = entries.filter((e) => isUnread(st, e)).length;
  st.newEl.textContent = unread ? `${unread} new` : "";
  st.newEl.hidden = unread === 0;
  const counts: Record<WireFilter, number> = { all: 0, press: 0, posts: 0 };
  for (const e of entries) {
    counts.all += 1 + e.similar;
    if (e.item.kind === "post") counts.posts += 1 + e.similar;
    else counts.press += 1;
  }
  for (const [id, n] of st.segCounts)
    n.textContent = formatCompactCount(counts[id]);
  st.countEl.parentElement?.setAttribute(
    "aria-label",
    `${formatCount(total)} items${unread ? `, ${unread} unread` : ""}`,
  );
}

function formatCompactCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${Math.round(n / 1000)}K`;
}

/* ------------------------------------------------------------- banner */

function dismissBanner(st: WireState) {
  clearTimeout(st.bannerTimer);
  const banner = st.bannerSlot.firstElementChild as HTMLElement | null;
  if (!banner) return;
  const done = () => {
    st.bannerSlot.replaceChildren();
    st.root.toggleAttribute("data-alert", hasUnreadBreaking(st));
  };
  if (!st.reduced && typeof banner.animate === "function") {
    const height = banner.offsetHeight;
    const a = banner.animate(
      [
        { opacity: 1, height: `${height}px` },
        { opacity: 0, height: "0px" },
      ],
      { duration: 280, easing: EASE, fill: "forwards" },
    );
    a.onfinish = done;
  } else done();
}

function hasUnreadBreaking(st: WireState): boolean {
  for (const e of st.entries.values())
    if (e.item.breaking && isUnread(st, e)) return true;
  return st.bannerSlot.childElementCount > 0;
}

function showBanner(st: WireState, entry: WireEntry) {
  clearTimeout(st.bannerTimer);
  const item = entry.item;
  const banner = h("div", "wr-banner");
  const top = h("div", "wr-banner-top");
  const kicker = h("span", "wr-kicker", "Breaking");
  const outlet = h("span", "wr-banner-src");
  outlet.append(
    wireBrand.logo(item.source.id, { size: 12, name: item.source.name }),
    document.createTextNode(item.source.name),
  );
  top.append(
    kicker,
    outlet,
    h("span", "wr-fill"),
    h("time", "wr-time", entry.dateLabel),
  );
  const link = h("button", "wr-banner-hl", item.text);
  link.type = "button";
  link.setAttribute("aria-label", `Breaking: ${item.text}. Show in the wire.`);
  link.addEventListener("click", () => {
    const node = st.nodes.get(entry.key);
    if (st.filter === "posts") {
      st.filter = "all";
      applyVisibility(st);
    }
    dismissBanner(st);
    if (node) {
      node.scrollIntoView({
        block: "nearest",
        behavior: st.reduced ? "auto" : "smooth",
      });
      node.focus({ preventScroll: true });
      node.dataset.open = "true";
    }
  });
  const close = h("button", "wr-banner-x");
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss breaking news banner");
  close.append(icon("close", 12));
  close.addEventListener("click", () => dismissBanner(st));
  const timer = h("span", "wr-banner-timer");
  timer.setAttribute("aria-hidden", "true");
  timer.style.setProperty("--wr-banner-ms", `${BANNER_MS}ms`);
  banner.append(top, link, close, timer);
  const arm = (ms: number) => {
    clearTimeout(st.bannerTimer);
    st.bannerTimer = window.setTimeout(() => dismissBanner(st), ms);
  };
  banner.addEventListener("mouseenter", () => {
    clearTimeout(st.bannerTimer);
    banner.dataset.hold = "true";
  });
  banner.addEventListener("mouseleave", () => {
    banner.dataset.hold = "false";
    arm(4000);
  });
  banner.addEventListener("focusin", () => {
    clearTimeout(st.bannerTimer);
    banner.dataset.hold = "true";
  });
  banner.addEventListener("focusout", (e) => {
    if (banner.contains(e.relatedTarget as Node | null)) return;
    banner.dataset.hold = "false";
    arm(4000);
  });
  st.bannerSlot.replaceChildren(banner);
  st.root.setAttribute("data-alert", "");
  if (!st.reduced && typeof banner.animate === "function") {
    const height = banner.offsetHeight;
    banner.animate(
      [
        { opacity: 0, height: "0px" },
        { opacity: 1, height: `${height}px` },
      ],
      { duration: 460, easing: EASE },
    );
  }
  arm(BANNER_MS);
}

/* ------------------------------------------------------------- factoid */

function setFactoid(st: WireState, text: string | null) {
  const value = text && text.trim() ? text.trim() : null;
  if (value === st.factoidValue) return;
  st.factoidValue = value;
  st.factoid.hidden = value === null;
  if (value === null) return;
  st.factoidText.textContent = value;
  if (!st.reduced && !st.first && typeof st.factoidText.animate === "function")
    st.factoidText.animate(
      [
        { opacity: 0, filter: "blur(2px)" },
        { opacity: 1, filter: "none" },
      ],
      { duration: 620, easing: EASE },
    );
}

/* ------------------------------------------------------------- update */

/**
 * The first card still (partly) in view and its offset from the top of the
 * viewport. Layout offsets (the scroller is the cards' offsetParent) ignore
 * running slide-in transforms, so anchoring stays exact mid-animation.
 */
function anchorOf(st: WireState): { key: string; y: number } | null {
  const top = st.scroller.scrollTop;
  if (top <= 4) return null;
  for (const node of st.feed.children as HTMLCollectionOf<HTMLElement>) {
    if (node.hidden) continue;
    if (node.offsetTop + node.offsetHeight > top + 1)
      return { key: node.dataset.key ?? "", y: node.offsetTop - top };
  }
  return null;
}

function update(st: WireState, view: WireView) {
  st.view = view;
  st.reduced = Boolean(view.reducedMotion) || prefersReduced();
  const root = st.root;
  root.dataset.variant = view.variant ?? "panel";
  root.dataset.stage = String(
    Math.max(1, Math.min(7, Math.round(view.stage || 1))),
  );
  root.dataset.motion = st.reduced ? "reduced" : "full";
  const sat = Math.max(0, Math.min(1, view.botSaturation || 0));
  root.dataset.sat =
    sat >= 0.75 ? "3" : sat >= 0.5 ? "2" : sat >= 0.25 ? "1" : "0";
  root.style.setProperty("--wr-sat", sat.toFixed(3));

  const entries = buildWireEntries(view.items, sat);
  const maxDay = view.items.reduce<number | null>(
    (m, i) => (i.day === null ? m : m === null ? i.day : Math.max(m, i.day)),
    null,
  );
  st.ctx = {
    today: view.today ?? maxDay,
    botSaturation: sat,
    idPrefix: st.ctx.idPrefix,
  };

  // Read state. Without a persisted list, what exists at mount counts as seen.
  if (view.readIds) for (const id of view.readIds) st.read.add(id);
  else if (st.first)
    for (const e of entries) for (const id of e.members) st.read.add(id);

  const atTop = st.scroller.scrollTop <= 4;
  const anchor = atTop ? null : anchorOf(st);
  const animate = !st.first && atTop && !st.reduced;
  const before = new Map<string, number>();
  if (animate)
    for (const [k, n] of st.nodes)
      if (!n.hidden) before.set(k, n.getBoundingClientRect().top);

  st.entries = new Map(entries.map((e) => [e.key, e]));
  const result = reconcileKeyed<HTMLElement, WireEntry>(
    {
      nodes: () => [...st.feed.children] as HTMLElement[],
      insertBefore: (node, ref) => st.feed.insertBefore(node, ref),
      remove: (node) => {
        st.io?.unobserve(node);
        node.remove();
      },
    },
    entries,
    (e) => e.key,
    st.nodes,
    (entry) => {
      const article = h("article", "wr-card");
      article.tabIndex = -1;
      article.dataset.key = entry.key;
      article.dataset.open = "false";
      const sig = cardSignature(entry, st.ctx);
      st.sigs.set(entry.key, sig);
      fillCard(article, entry, st.ctx);
      st.io?.observe(article);
      return article;
    },
    (article, entry) => {
      const sig = cardSignature(entry, st.ctx);
      if (st.sigs.get(entry.key) === sig) return;
      st.sigs.set(entry.key, sig);
      fillCard(article, entry, st.ctx);
    },
  );
  for (const key of result.removed) {
    st.sigs.delete(key);
    const t = st.readTimers.get(key);
    if (t !== undefined) clearTimeout(t);
    st.readTimers.delete(key);
  }
  for (const [key, node] of st.nodes) {
    const entry = st.entries.get(key)!;
    node.dataset.read = isUnread(st, entry) ? "false" : "true";
    node.dataset.breaking = entry.item.breaking ? "true" : "false";
  }
  applyVisibility(st);

  // Motion or anchoring ------------------------------------------------
  // Arrivals are counted by member id: a copy that joins an existing pile is
  // news even though it adds no node.
  let arrivals = 0;
  for (const e of entries) {
    if (!matchesFilter(e, st.filter)) continue;
    for (const id of e.members) if (!st.seen.has(id)) arrivals++;
  }
  for (const e of entries) for (const id of e.members) st.seen.add(id);
  const addedVisible = result.added.filter((k) => !st.nodes.get(k)?.hidden);
  if (anchor) {
    const node = st.nodes.get(anchor.key);
    if (node && !node.hidden) st.scroller.scrollTop = node.offsetTop - anchor.y;
    if (!st.first && arrivals > 0) showPill(st, arrivals);
  } else if (animate) {
    for (const key of addedVisible) {
      const node = st.nodes.get(key)!;
      node.dataset.fresh = "true";
      window.setTimeout(() => {
        if (node.dataset.fresh === "true") node.dataset.fresh = "false";
      }, 2400);
      if (typeof node.animate === "function")
        node.animate(
          [
            {
              opacity: 0,
              transform: "translateY(-14px)",
              clipPath: "inset(0 0 100% 0)",
            },
            { opacity: 1, transform: "none", clipPath: "inset(0 0 0 0)" },
          ],
          { duration: 560, easing: EASE },
        );
    }
    for (const [key, top] of before) {
      const node = st.nodes.get(key);
      if (!node || node.hidden) continue;
      const delta = top - node.getBoundingClientRect().top;
      if (Math.abs(delta) > 0.5 && typeof node.animate === "function")
        node.animate(
          [{ transform: `translateY(${delta}px)` }, { transform: "none" }],
          { duration: 560, easing: EASE },
        );
    }
  }

  // The live dot pulses when something is filed, then rests (WCAG 2.2.2).
  if (arrivals > 0 && !st.first && !st.reduced) {
    root.removeAttribute("data-ping");
    void root.offsetWidth;
    root.setAttribute("data-ping", "");
  }

  // Header -------------------------------------------------------------
  updateCounts(st);
  const newest = entries[0];
  st.updatedEl.textContent = newest
    ? `Updated ${newest.dateLabel}`
    : "No reports filed";

  // Breaking banner: each severity-2 story is bannered once. At mount only
  // today's breaking news is shown.
  const candidates = entries.filter(
    (e) => e.item.breaking && !st.bannered.has(e.key),
  );
  const fresh = st.first
    ? candidates.filter(
        (e) => e.item.day !== null && e.item.day === st.ctx.today,
      )
    : candidates;
  for (const e of candidates) st.bannered.add(e.key);
  if (fresh.length) showBanner(st, fresh[0]!);
  root.toggleAttribute("data-alert", hasUnreadBreaking(st));

  setFactoid(st, view.factoid ?? null);

  // Ticker ---------------------------------------------------------------
  const tickerHost =
    st.options.tickerHost === undefined ? st.footer : st.options.tickerHost;
  if (st.tickerMount && st.tickerMount !== tickerHost) {
    disposeTicker(st.tickerMount);
    st.tickerMount = null;
  }
  st.footer.hidden = tickerHost !== st.footer || view.ticker.length === 0;
  if (tickerHost) {
    renderTicker(tickerHost, {
      lines: view.ticker,
      reducedMotion: st.reduced,
      stage: view.stage,
      label: "Wire",
    });
    st.tickerMount = tickerHost;
  }

  st.first = false;
}

/* ------------------------------------------------------------- public */

export function renderWire(
  host: HTMLElement,
  view: WireView,
  options: WireRenderOptions = {},
): void {
  const st = states.get(host) ?? mount(host, options);
  st.options = { ...st.options, ...options };
  update(st, view);
}

export function disposeWire(host: HTMLElement): void {
  const st = states.get(host);
  if (!st) return;
  clearTimeout(st.bannerTimer);
  for (const t of st.readTimers.values()) clearTimeout(t);
  st.io?.disconnect();
  for (const fn of st.cleanup) fn();
  if (st.tickerMount) disposeTicker(st.tickerMount);
  st.root.remove();
  states.delete(host);
}

/** For the orchestrator's debug overlay and tests: the ids the reader has seen. */
export function wireReadIds(host: HTMLElement): string[] {
  return [...(states.get(host)?.read ?? [])];
}
