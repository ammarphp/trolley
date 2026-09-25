/**
 * The ticker: a slim marquee strip for the bottom of the screen.
 *
 * - Moves only when motion is allowed; pauses on hover, on focus, and with its
 *   own pause button (WCAG 2.2.2).
 * - Under reduced motion (flag or media query) it is a static, horizontally
 *   scrollable list.
 * - Screen readers get one plain list, once. The looping copy is aria-hidden
 *   and nothing here is aria-live: a ticker must never chatter.
 */
import { icon } from "./brand-bridge.ts";
import { normalizeTickerLines, tickerText } from "./normalize.ts";

export interface TickerView {
  lines: readonly string[];
  reducedMotion: boolean;
  stage?: number;
  /** Visible label on the left of the strip. */
  label?: string;
}

interface TickerState {
  root: HTMLElement;
  viewport: HTMLElement;
  rail: HTMLElement;
  list: HTMLUListElement;
  clone: HTMLUListElement;
  toggle: HTMLButtonElement;
  labelText: HTMLElement;
  text: string;
  paused: boolean;
  frame: number;
  resize: ResizeObserver | null;
}

const states = new WeakMap<HTMLElement, TickerState>();

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

function fillList(list: HTMLUListElement, lines: readonly string[]) {
  list.replaceChildren(
    ...lines.map((line) => {
      const li = h("li", "wr-tk-item");
      const breaking = /^breaking\s*[:—-]\s*/i.exec(line);
      if (breaking) {
        li.classList.add("is-breaking");
        li.append(
          h("span", "wr-tk-kicker", "Breaking"),
          document.createTextNode(line.slice(breaking[0].length)),
        );
      } else li.textContent = line;
      return li;
    }),
  );
}

function measure(state: TickerState, stage: number) {
  cancelAnimationFrame(state.frame);
  state.frame = requestAnimationFrame(() => {
    const width = state.list.scrollWidth;
    const speed = 34 + Math.max(1, Math.min(7, stage)) * 6; // px per second
    const seconds = Math.max(18, width / speed);
    state.rail.style.setProperty("--wr-tk-dur", `${seconds.toFixed(2)}s`);
    state.root.dataset.ready = "true";
  });
}

function setPaused(state: TickerState, paused: boolean) {
  state.paused = paused;
  state.root.toggleAttribute("data-paused", paused);
  state.toggle.setAttribute("aria-pressed", String(paused));
  state.toggle.setAttribute(
    "aria-label",
    paused ? "Resume ticker" : "Pause ticker",
  );
  state.toggle.replaceChildren(icon(paused ? "play" : "pause", 14));
}

export function renderTicker(host: HTMLElement, view: TickerView): void {
  const lines = normalizeTickerLines(view.lines);
  const text = tickerText(lines);
  let state = states.get(host);
  if (!state) {
    const root = h("section", "wr-ticker");
    root.setAttribute("aria-label", "News ticker");
    const label = h("span", "wr-tk-label");
    label.setAttribute("aria-hidden", "true");
    const labelText = h("span", "", view.label ?? "Wire");
    label.append(h("span", "wr-tk-dot"), labelText);
    const viewport = h("div", "wr-tk-viewport");
    viewport.tabIndex = 0;
    viewport.setAttribute("role", "region");
    viewport.setAttribute(
      "aria-label",
      "Ticker headlines. Focus pauses the ticker.",
    );
    const rail = h("div", "wr-tk-rail");
    const list = h("ul", "wr-tk-list");
    const clone = h("ul", "wr-tk-list wr-tk-clone");
    clone.setAttribute("aria-hidden", "true");
    rail.append(list, clone);
    viewport.append(rail);
    const toggle = h("button", "wr-tk-toggle");
    toggle.type = "button";
    root.append(label, viewport, toggle);
    host.append(root);
    state = {
      root,
      viewport,
      rail,
      list,
      clone,
      toggle,
      labelText,
      text: "\u0000",
      paused: false,
      frame: 0,
      resize: null,
    };
    const s = state;
    toggle.addEventListener("click", () => setPaused(s, !s.paused));
    setPaused(state, false);
    if (typeof ResizeObserver !== "undefined") {
      state.resize = new ResizeObserver(() =>
        measure(s, Number(s.root.dataset.stage) || 1),
      );
      state.resize.observe(viewport);
    }
    states.set(host, state);
  }
  state.labelText.textContent = view.label ?? "Wire";
  state.root.dataset.stage = String(view.stage ?? 1);
  state.root.dataset.motion = view.reducedMotion ? "reduced" : "full";
  state.root.toggleAttribute("data-empty", lines.length === 0);
  if (text !== state.text) {
    state.text = text;
    fillList(state.list, lines);
    fillList(state.clone, lines);
    state.root.dataset.ready = "false";
  }
  measure(state, view.stage ?? 1);
}

export function disposeTicker(host: HTMLElement): void {
  const state = states.get(host);
  if (!state) return;
  cancelAnimationFrame(state.frame);
  state.resize?.disconnect();
  state.root.remove();
  states.delete(host);
}
