/**
 * The glossary popover: one small glass card, shared by every annotated term
 * under a delegation root.
 *
 * Opening:  hover (after a delay, pointer devices only), keyboard focus, or
 *           click/tap/Enter (which pins it open).
 * Closing:  Escape, focus leaving term and card, a pointer press elsewhere,
 *           the close button, or the pointer leaving an unpinned hover card.
 * Keyboard: Tab (or ArrowDown) from a pinned term moves into the card; Tab past
 *           its last control continues after the term; Shift+Tab returns.
 *
 * The card is rendered with the Popover API when available, so it sits in the
 * top layer above modal dialogs and escapes clipping by glass panels. It is
 * appended to the nearest open <dialog> around the term (so it stays
 * interactive while that dialog is modal) or to `layer` (default <body>).
 */
import {
  DOMAIN_LABEL,
  glossaryEntry,
  sourceLinks,
  type GlossaryEntry,
} from "../../content/glossary.ts";

export type OpenVia = "hover" | "focus" | "click" | "api";

export interface GlossaryPopoverOptions {
  /** Where annotated terms live. Events are delegated from here. Default: document. */
  root?: HTMLElement | Document;
  /** Where the card is appended when the term is not inside an open dialog. Default: <body>. */
  layer?: HTMLElement;
  /** Mirrors the player's reduced-motion setting. prefers-reduced-motion is honoured regardless. */
  reducedMotion?: boolean;
  /** Hover intent delay in ms (default 380). A second hover while a card is open uses 90 ms. */
  openDelay?: number;
  /** Grace period in ms before an unpinned hover card closes (default 220). */
  closeDelay?: number;
  /** Entry lookup (tests or alternative glossaries). */
  lookup?: (id: string) => GlossaryEntry | undefined;
  /** A card opened, or switched to a different term. */
  onOpen?: (termId: string, via: OpenVia) => void;
  /** The card closed. */
  onClose?: (termId: string) => void;
  /** A source link in the card was activated (it opens in a new tab). */
  onSourceOpen?: (sourceId: string, termId: string) => void;
}

export interface GlossaryPopoverController {
  /** The card element (for inspection; do not restyle). */
  readonly element: HTMLElement;
  /** Glossary id of the entry currently shown, or null when closed. */
  readonly openId: string | null;
  /** Open for a term button; "click" and "api" pin the card. */
  open(trigger: HTMLElement, via?: OpenVia): void;
  close(options?: { restoreFocus?: boolean }): void;
  setReducedMotion(value: boolean): void;
  /** Re-measure after layout changes the host could not signal. */
  reposition(): void;
  destroy(): void;
}

const TERM_SELECTOR = "button.term[data-term]";
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const MARGIN = 12;
const GAP = 10;
let instances = 0;

type Timer = ReturnType<typeof setTimeout>;

export function mountGlossary(
  options: GlossaryPopoverOptions = {},
): GlossaryPopoverController {
  const root: HTMLElement | Document = options.root ?? document;
  const doc = root instanceof Document ? root : root.ownerDocument;
  const win = doc.defaultView ?? window;
  const lookup = options.lookup ?? glossaryEntry;
  const openDelay = options.openDelay ?? 380;
  const closeDelay = options.closeDelay ?? 220;
  const uid = `glp-${++instances}`;
  let reducedMotion = options.reducedMotion ?? false;

  /* ------------------------------------------------------------ element */
  const pop = doc.createElement("div");
  pop.className = "glp";
  pop.id = uid;
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-modal", "false");
  pop.setAttribute("aria-labelledby", `${uid}-title`);
  pop.dataset.state = "closed";
  // Clicking the card's text focuses the card itself instead of <body>, so a
  // click inside never reads as the blur that closes it.
  pop.tabIndex = -1;
  if (reducedMotion) pop.dataset.motion = "reduced";
  const supportsPopover =
    typeof (pop as HTMLElement & { showPopover?: unknown }).showPopover ===
    "function";
  if (supportsPopover) pop.setAttribute("popover", "manual");
  else {
    pop.hidden = true;
    pop.classList.add("glp--fallback");
  }
  const caret = doc.createElement("span");
  caret.className = "glp-caret";
  caret.setAttribute("aria-hidden", "true");
  const scroll = doc.createElement("div");
  scroll.className = "glp-scroll";
  pop.append(caret, scroll);

  /* -------------------------------------------------------------- state */
  let trigger: HTMLElement | null = null;
  let shownId: string | null = null;
  let back: string[] = [];
  let hover = false;
  let focus = false;
  let pinned = false;
  let lastVia: OpenVia = "api";
  let openTimer: Timer | null = null;
  let closeTimer: Timer | null = null;
  let pendingTrigger: HTMLElement | null = null;
  let frame = 0;
  /** True while focus is moved programmatically, so focusin does not reopen. */
  let restoring = false;

  const isOpen = () => shownId !== null;
  const inside = (node: EventTarget | null | undefined, el: Element | null) =>
    !!node && !!el && node instanceof Node && el.contains(node);
  const termFrom = (node: EventTarget | null): HTMLElement | null => {
    if (!(node instanceof Element)) return null;
    const t = node.closest<HTMLElement>(TERM_SELECTOR);
    if (!t) return null;
    if (root instanceof Document) return t;
    return root.contains(t) ? t : null;
  };
  const clearTimers = () => {
    if (openTimer) clearTimeout(openTimer);
    if (closeTimer) clearTimeout(closeTimer);
    openTimer = closeTimer = null;
    pendingTrigger = null;
  };

  /* ------------------------------------------------------------ content */
  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    cls = "",
    text?: string,
  ) {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function render(entry: GlossaryEntry) {
    shownId = entry.id;
    pop.dataset.domain = entry.domain;
    const head = el("div", "glp-head");
    const kicker = el("p", "glp-kicker");
    kicker.append(
      el("span", "glp-kicker-main", "Glossary"),
      el("span", "glp-kicker-sep", "/"),
      el("span", "", DOMAIN_LABEL[entry.domain]),
    );
    head.append(kicker);

    const title = el("h2", "glp-title", entry.term);
    title.id = `${uid}-title`;
    title.tabIndex = -1;

    const body: HTMLElement[] = [head];
    if (back.length) {
      const prev = lookup(back[back.length - 1]!);
      const backBtn = el(
        "button",
        "glp-back",
        `Back to ${prev?.term ?? "previous term"}`,
      );
      backBtn.type = "button";
      backBtn.addEventListener("click", () => {
        const id = back.pop();
        const target = id ? lookup(id) : undefined;
        if (target) swap(target);
      });
      body.push(backBtn);
    }
    body.push(title, el("p", "glp-short", entry.short));

    if (entry.long) {
      const more = el("div", "glp-more");
      more.id = `${uid}-more`;
      more.hidden = true;
      more.append(el("p", "", entry.long));
      const toggle = el("button", "glp-toggle");
      toggle.type = "button";
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-controls", more.id);
      const label = el("span", "", "Read more");
      const chevron = el("span", "glp-chevron");
      chevron.setAttribute("aria-hidden", "true");
      toggle.append(label, chevron);
      toggle.addEventListener("click", () => {
        const expanded = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", String(expanded));
        label.textContent = expanded ? "Show less" : "Read more";
        more.hidden = !expanded;
        pinned = true;
        position();
      });
      body.push(more, toggle);
    }

    const links = sourceLinks(entry.sourceIds).filter((s) => s.url);
    if (links.length) {
      const section = el("section", "glp-sources");
      const label = el(
        "h3",
        "glp-label",
        links.length === 1
          ? "Source · research registry"
          : "Sources · research registry",
      );
      label.id = `${uid}-sources`;
      section.setAttribute("aria-labelledby", label.id);
      const list = el("ul", "glp-source-list");
      for (const s of links) {
        const item = el("li");
        const a = el("a", "glp-source");
        a.href = s.url!;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.append(
          el("span", "glp-source-title", s.title),
          el("span", "glp-source-host", s.host),
        );
        const sr = el("span", "gl-sr", " (opens in a new tab)");
        a.append(sr);
        a.addEventListener("click", () =>
          options.onSourceOpen?.(s.id, entry.id),
        );
        item.append(a);
        list.append(item);
      }
      section.append(
        label,
        list,
        el(
          "p",
          "glp-fine",
          "Sources describe the concept, not this game’s numbers.",
        ),
      );
      body.push(section);
    }

    const related = (entry.related ?? [])
      .map((id) => lookup(id))
      .filter((r): r is GlossaryEntry => !!r);
    if (related.length) {
      const nav = el("nav", "glp-related");
      nav.setAttribute("aria-label", "Related terms");
      nav.append(el("span", "glp-label", "See also"));
      const list = el("span", "glp-related-list");
      for (const r of related) {
        const b = el("button", "glp-rel", r.term);
        b.type = "button";
        b.addEventListener("click", () => {
          if (shownId) back.push(shownId);
          swap(r);
        });
        list.append(b);
      }
      nav.append(list);
      body.push(nav);
    }

    const hint = el("p", "glp-hint");
    hint.setAttribute("aria-hidden", "true");
    body.push(hint);
    const close = el("button", "glp-close");
    close.type = "button";
    close.setAttribute("aria-label", "Close definition");
    const x = el("span", "glp-close-x", "×");
    x.setAttribute("aria-hidden", "true");
    close.append(el("span", "glp-close-key", "Esc"), x);
    close.addEventListener("click", () => api.close({ restoreFocus: true }));
    body.push(close);
    scroll.replaceChildren(...body);
    updateHint();
  }

  function updateHint() {
    const hint = scroll.querySelector<HTMLElement>(".glp-hint");
    if (!hint) return;
    const keyboard =
      lastVia === "focus" ||
      (pinned && trigger !== null && doc.activeElement === trigger);
    hint.hidden = !keyboard;
    hint.textContent = pinned
      ? "Tab into card · Esc close"
      : "Enter pin · Esc close";
  }

  function swap(entry: GlossaryEntry) {
    pinned = true;
    render(entry);
    position();
    scroll
      .querySelector<HTMLElement>(".glp-title")
      ?.focus({ preventScroll: true });
    options.onOpen?.(entry.id, "click");
  }

  /* ---------------------------------------------------------- placement */
  function layerFor(t: HTMLElement): HTMLElement {
    const dialog = t.closest("dialog");
    if (dialog && (dialog as HTMLDialogElement).open)
      return dialog as HTMLElement;
    return options.layer ?? doc.body;
  }

  function show(layer: HTMLElement) {
    const p = pop as HTMLElement & {
      showPopover?: () => void;
      hidePopover?: () => void;
    };
    if (pop.parentElement !== layer) {
      if (supportsPopover && pop.matches(":popover-open")) p.hidePopover?.();
      layer.append(pop);
    }
    if (supportsPopover) {
      if (!pop.matches(":popover-open")) p.showPopover?.();
    } else pop.hidden = false;
  }

  function hide() {
    const p = pop as HTMLElement & { hidePopover?: () => void };
    if (supportsPopover) {
      if (pop.isConnected && pop.matches(":popover-open")) p.hidePopover?.();
    } else pop.hidden = true;
    pop.dataset.state = "closed";
  }

  function viewport() {
    const vv = win.visualViewport;
    const w = doc.documentElement.clientWidth || win.innerWidth;
    const h = doc.documentElement.clientHeight || win.innerHeight;
    return {
      w: vv ? Math.min(w, vv.width) : w,
      h: vv ? Math.min(h, vv.height) : h,
    };
  }

  function position() {
    if (!trigger || !isOpen()) return;
    if (!trigger.isConnected || !pop.isConnected) {
      api.close();
      return;
    }
    const rects = trigger.getClientRects();
    const r = rects.length ? rects[0]! : trigger.getBoundingClientRect();
    const { w: vw, h: vh } = viewport();
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) {
      api.close();
      return;
    }
    pop.style.maxHeight = "";
    pop.style.left = "0px";
    pop.style.top = "0px";
    // Correct for a containing block other than the viewport (fallback path,
    // or an ancestor with a transform or backdrop filter).
    const origin = pop.getBoundingClientRect();
    const pw = pop.offsetWidth;
    let ph = pop.offsetHeight;
    const below = vh - r.bottom - GAP - MARGIN;
    const above = r.top - GAP - MARGIN;
    const side: "below" | "above" =
      below >= ph || below >= above ? "below" : "above";
    const room = Math.max(120, side === "below" ? below : above);
    if (ph > room) {
      pop.style.maxHeight = `${room}px`;
      ph = room;
    }
    const top = side === "below" ? r.bottom + GAP : r.top - GAP - ph;
    const centre = r.left + r.width / 2;
    const left = Math.min(
      Math.max(MARGIN, centre - pw / 2),
      Math.max(MARGIN, vw - MARGIN - pw),
    );
    pop.style.left = `${Math.round(left - origin.left)}px`;
    pop.style.top = `${Math.round(top - origin.top)}px`;
    pop.dataset.side = side;
    caret.style.left = `${Math.round(Math.min(Math.max(16, centre - left), pw - 16))}px`;
  }

  const schedulePosition = () => {
    if (!isOpen() || frame) return;
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      position();
    });
  };

  /* --------------------------------------------------------- open/close */
  function setExpanded(t: HTMLElement | null, value: boolean) {
    if (!t) return;
    t.setAttribute("aria-expanded", String(value));
    if (value) t.setAttribute("aria-controls", uid);
    else t.removeAttribute("aria-controls");
    t.classList.toggle("is-open", value);
  }

  function openFor(t: HTMLElement, via: OpenVia) {
    const id = t.getAttribute("data-term") ?? "";
    const entry = lookup(id);
    if (!entry) return;
    clearTimers();
    const changed = t !== trigger || shownId !== entry.id;
    if (trigger && trigger !== t) {
      setExpanded(trigger, false);
      hover = focus = pinned = false;
    }
    trigger = t;
    lastVia = via;
    if (via === "click" || via === "api") pinned = true;
    if (via === "hover") hover = true;
    if (via === "focus") focus = true;
    if (changed) {
      back = [];
      render(entry);
    } else updateHint();
    show(layerFor(t));
    setExpanded(t, true);
    position();
    if (reducedMotion || pop.dataset.state === "open")
      pop.dataset.state = "open";
    else
      win.requestAnimationFrame(() => {
        if (isOpen()) pop.dataset.state = "open";
      });
    if (changed) options.onOpen?.(entry.id, via);
  }

  function closeNow(restoreFocus = false) {
    clearTimers();
    if (!isOpen()) return;
    const id = shownId!;
    const t = trigger;
    const focusWasInside = inside(doc.activeElement, pop);
    shownId = null;
    hover = focus = pinned = false;
    back = [];
    hide();
    setExpanded(t, false);
    if (t && t.isConnected && (restoreFocus || focusWasInside)) focusQuietly(t);
    options.onClose?.(id);
  }

  function focusQuietly(target: HTMLElement) {
    restoring = true;
    try {
      target.focus({ preventScroll: true });
    } finally {
      restoring = false;
    }
  }

  function settle() {
    if (!isOpen() || hover || focus || pinned) return;
    closeNow();
  }

  function scheduleSettle() {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      closeTimer = null;
      settle();
    }, closeDelay);
  }

  /* ------------------------------------------------------------- events */
  const onPointerOver = (event: Event) => {
    const e = event as PointerEvent;
    if (e.pointerType === "touch") return;
    const t = termFrom(e.target);
    if (!t) return;
    if (t === trigger && isOpen()) {
      hover = true;
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = null;
      return;
    }
    // Never hijack a card the reader pinned or reached by keyboard.
    if (isOpen() && (pinned || focus)) return;
    if (pendingTrigger === t) return;
    if (openTimer) clearTimeout(openTimer);
    pendingTrigger = t;
    // A card that is open only because of hover hands over quickly.
    openTimer = setTimeout(
      () => {
        openTimer = null;
        pendingTrigger = null;
        if (t.isConnected) openFor(t, "hover");
      },
      isOpen() ? 90 : openDelay,
    );
  };

  const onPointerOut = (event: Event) => {
    const e = event as PointerEvent;
    const t = termFrom(e.target);
    if (!t) return;
    if (inside(e.relatedTarget, t) || inside(e.relatedTarget, pop)) return;
    if (pendingTrigger === t) {
      if (openTimer) clearTimeout(openTimer);
      openTimer = null;
      pendingTrigger = null;
    }
    if (t === trigger) {
      hover = false;
      scheduleSettle();
    }
  };

  const onPopEnter = () => {
    hover = true;
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = null;
  };
  const onPopLeave = (event: Event) => {
    const e = event as PointerEvent;
    if (inside(e.relatedTarget, trigger)) return;
    hover = false;
    scheduleSettle();
  };

  const onFocusIn = (event: Event) => {
    if (restoring) return;
    const t = termFrom(event.target);
    if (!t) return;
    let visible = true;
    try {
      visible = t.matches(":focus-visible");
    } catch {
      /* older engines: treat all focus as keyboard focus */
    }
    if (t === trigger && isOpen()) {
      focus = true;
      return;
    }
    if (!visible) return;
    openFor(t, "focus");
  };

  const onFocusOut = (event: Event) => {
    const e = event as FocusEvent;
    if (!isOpen()) return;
    const next = e.relatedTarget;
    if (inside(next, pop) || inside(next, trigger)) return;
    // Focus left both the term and its card: this is the blur that closes.
    const leftFrom = e.target;
    if (!inside(leftFrom, pop) && !inside(leftFrom, trigger)) return;
    focus = false;
    pinned = false;
    if (hover) scheduleSettle();
    else closeNow();
  };

  const onClick = (event: Event) => {
    const t = termFrom(event.target);
    if (!t) return;
    event.preventDefault();
    if (t === trigger && isOpen() && pinned) {
      closeNow();
      return;
    }
    openFor(t, "click");
    pinned = true;
    updateHint();
  };

  function focusables(): HTMLElement[] {
    return [...pop.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (n) => !n.closest("[hidden]") && n.getClientRects().length > 0,
    );
  }

  function nextAfterTrigger(): HTMLElement | null {
    if (!trigger) return null;
    const scope: ParentNode = trigger.closest("dialog[open]") ?? doc;
    const all = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (n) =>
        !pop.contains(n) &&
        !n.closest("[inert]") &&
        !n.closest("[hidden]") &&
        n.getClientRects().length > 0,
    );
    const i = all.indexOf(trigger);
    return i >= 0 ? (all[i + 1] ?? null) : null;
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!isOpen()) return;
    const active = doc.activeElement;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeNow(inside(active, pop) || active === trigger);
      return;
    }
    const onTrigger = active === trigger;
    const inPop = inside(active, pop);
    if (
      onTrigger &&
      (event.key === "ArrowDown" ||
        (event.key === "Tab" && !event.shiftKey && pinned))
    ) {
      const first = focusables()[0];
      if (!first) return;
      event.preventDefault();
      pinned = true;
      updateHint();
      first.focus({ preventScroll: true });
      return;
    }
    if (inPop && event.key === "Tab") {
      const list = focusables();
      if (!list.length) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      if (
        event.shiftKey &&
        (active === first ||
          active === scroll.querySelector(".glp-title") ||
          active === pop)
      ) {
        event.preventDefault();
        if (trigger) focusQuietly(trigger);
        focus = true;
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        // The card sits elsewhere in the DOM; continue the tab order from the term.
        const next = nextAfterTrigger();
        if (next) next.focus();
        else {
          closeNow();
          if (trigger) focusQuietly(trigger);
        }
      }
    }
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!isOpen()) return;
    if (inside(event.target, pop) || inside(event.target, trigger)) return;
    closeNow();
  };

  const onEnvChange = () => schedulePosition();

  const rootTarget: EventTarget = root;
  rootTarget.addEventListener("pointerover", onPointerOver);
  rootTarget.addEventListener("pointerout", onPointerOut);
  rootTarget.addEventListener("focusin", onFocusIn);
  rootTarget.addEventListener("focusout", onFocusOut);
  rootTarget.addEventListener("click", onClick);
  pop.addEventListener("pointerenter", onPopEnter);
  pop.addEventListener("pointerleave", onPopLeave);
  pop.addEventListener("focusout", onFocusOut);
  doc.addEventListener("keydown", onKeyDown, true);
  doc.addEventListener("pointerdown", onPointerDown, true);
  win.addEventListener("scroll", onEnvChange, { capture: true, passive: true });
  win.addEventListener("resize", onEnvChange);
  win.visualViewport?.addEventListener("resize", onEnvChange);

  const api: GlossaryPopoverController = {
    element: pop,
    get openId() {
      return shownId;
    },
    open(t, via = "api") {
      openFor(t, via);
    },
    close(opts = {}) {
      closeNow(opts.restoreFocus ?? false);
    },
    setReducedMotion(value) {
      reducedMotion = value;
      if (value) pop.dataset.motion = "reduced";
      else delete pop.dataset.motion;
    },
    reposition() {
      position();
    },
    destroy() {
      closeNow();
      rootTarget.removeEventListener("pointerover", onPointerOver);
      rootTarget.removeEventListener("pointerout", onPointerOut);
      rootTarget.removeEventListener("focusin", onFocusIn);
      rootTarget.removeEventListener("focusout", onFocusOut);
      rootTarget.removeEventListener("click", onClick);
      doc.removeEventListener("keydown", onKeyDown, true);
      doc.removeEventListener("pointerdown", onPointerDown, true);
      win.removeEventListener("scroll", onEnvChange, { capture: true });
      win.removeEventListener("resize", onEnvChange);
      win.visualViewport?.removeEventListener("resize", onEnvChange);
      if (frame) win.cancelAnimationFrame(frame);
      pop.remove();
    },
  };
  return api;
}
