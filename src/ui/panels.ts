import { el as element } from "./dom.ts";
/** Authored conversation and reported instruments. No campaign mutations or model calls. */
export interface AdvisorQuestion {
  id: string;
  question: string;
  answer: string;
  reasoning?: string;
}
export interface AdvisorPanelView {
  online: boolean;
  locked: boolean;
  questions: AdvisorQuestion[];
  history: AdvisorQuestion[];
  readIds: string[];
  animateId?: string;
  reducedMotion?: boolean;
  onAsk: (question: AdvisorQuestion) => void;
  onReplyComplete?: (answer: string, id: string) => void;
}
export interface InstrumentView {
  label: string;
  value: number;
  display: string;
  maximum: number;
  kind: "economy" | "capability" | "fatalities";
  scale: string;
  history?: number[];
}
export interface Bulletin {
  id?: string;
  headline: string;
  source: string;
  day: number;
}
const activeReplies = new WeakMap<
  HTMLElement,
  { finish: () => void; dispose: () => void }
>();
/** Real pause and panel replacement cannot leave an invisible typewriter running. */
export function finishAdvisor(host: HTMLElement) {
  activeReplies.get(host)?.finish();
}
export function disposeAdvisor(host: HTMLElement) {
  activeReplies.get(host)?.dispose();
  activeReplies.delete(host);
}
function avatar() {
  const mark = element("span", "morrow-avatar", "m");
  mark.setAttribute("aria-hidden", "true");
  return mark;
}
function paragraphs(host: HTMLElement, text: string) {
  host.replaceChildren(...text.split(/\n\n+/).map((p) => element("p", "", p)));
}
export function renderAdvisor(host: HTMLElement, view: AdvisorPanelView) {
  disposeAdvisor(host);
  host.replaceChildren();
  host.className = "side-panel assistant-panel";
  host.setAttribute("aria-label", "Morrow conversation");
  const header = element("header", "chat-header");
  const name = element("div", "chat-identity");
  name.append(
    element("h2", "", "Morrow"),
    element("p", "", view.online ? "Here to help." : "Awaiting connection"),
  );
  const status = element("span", `signal ${view.online ? "online" : ""}`);
  status.title = view.online ? "Connected" : "Not connected";
  header.append(avatar(), name, status);
  host.append(header);
  const conversation = element("div", "conversation");
  conversation.setAttribute("role", "log");
  conversation.setAttribute("aria-live", "off");
  conversation.tabIndex = 0;
  conversation.setAttribute("aria-label", "Conversation with Morrow");
  if (!view.online) {
    const idle = element("div", "chat-waiting");
    idle.append(
      element("div", "radio-rings"),
      element("p", "", "A quiet line."),
      element("small", "", "For the moment, it's just you."),
    );
    conversation.append(idle);
    host.append(conversation);
    return;
  }
  let animated:
    | {
        entry: AdvisorQuestion;
        body: HTMLElement;
        state: HTMLElement;
        show: HTMLButtonElement;
      }
    | undefined;
  for (const entry of view.history) {
    const exchange = element("section", "exchange");
    const question = element("div", "chat-question", entry.question);
    question.setAttribute("aria-label", `You: ${entry.question}`);
    const reply = element("div", "assistant-message");
    reply.append(avatar());
    const content = element("div", "assistant-message-content");
    content.append(element("div", "chat-speaker", "Morrow"));
    if (entry.reasoning) {
      const reasoning = element("details", "chat-reasoning");
      reasoning.append(element("summary", "", "Reasoning"));
      const assessment = element("div", "reasoning-body");
      paragraphs(assessment, entry.reasoning);
      reasoning.append(assessment);
      content.append(reasoning);
    }
    const body = element("div", "chat-answer");
    const animate = entry.id === view.animateId && !view.reducedMotion;
    if (animate) {
      const state = element("div", "reply-state", "Thinking");
      state.setAttribute("aria-hidden", "true");
      const dots = element("span", "thinking-dots");
      dots.append(element("i"), element("i"), element("i"));
      state.append(dots);
      const show = element("button", "show-reply", "Show full reply");
      show.type = "button";
      content.append(state);
      animated = { entry, body, state, show };
      content.append(body, show);
    } else {
      paragraphs(body, entry.answer);
      content.append(body);
    }
    reply.append(content);
    exchange.append(question, reply);
    conversation.append(exchange);
  }
  if (!view.history.length) {
    const welcome = element("div", "chat-welcome");
    welcome.append(avatar(), element("p", "", "Let's work through this."));
    conversation.append(welcome);
  }
  host.append(conversation);
  const questions = element("div", "chat-composer");
  const remaining = view.questions.filter(
    (item) => !view.readIds.includes(item.id),
  );
  for (const item of remaining) {
    const question = element("button", "chat-prompt");
    question.type = "button";
    question.disabled = view.locked;
    question.append(element("span", "", item.question));
    const send = element("span", "send-question", "↑");
    send.setAttribute("aria-hidden", "true");
    question.append(send);
    question.onclick = () => view.onAsk(item);
    questions.append(question);
  }
  if (remaining.length) host.append(questions);
  conversation.scrollTop = conversation.scrollHeight;
  if (animated) {
    const { entry, body, state, show } = animated;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ended = false;
    const finish = () => {
      if (ended) return;
      const follow =
        conversation.scrollHeight -
          conversation.scrollTop -
          conversation.clientHeight <
        90;
      ended = true;
      clearTimeout(timer);
      paragraphs(body, entry.answer);
      state.remove();
      if (document.activeElement === show)
        conversation.focus({ preventScroll: true });
      show.remove();
      if (follow) conversation.scrollTop = conversation.scrollHeight;
      activeReplies.delete(host);
      view.onReplyComplete?.(entry.answer, entry.id);
    };
    const dispose = () => {
      ended = true;
      clearTimeout(timer);
    };
    activeReplies.set(host, { finish, dispose });
    show.onclick = () => {
      conversation.scrollTop = conversation.scrollHeight;
      finish();
    };
    const words = entry.answer.match(/\S+\s*/g) || [entry.answer];
    const chunk = Math.max(1, Math.ceil(words.length / 65));
    let cursor = 0;
    const reveal = () => {
      if (ended) return;
      if (!host.isConnected) {
        dispose();
        return;
      }
      state.firstChild!.textContent = "Writing";
      cursor = Math.min(words.length, cursor + chunk);
      paragraphs(body, words.slice(0, cursor).join(""));
      // Follow new text only while the reader is near the latest reply.
      if (
        conversation.scrollHeight -
          conversation.scrollTop -
          conversation.clientHeight <
        90
      )
        conversation.scrollTop = conversation.scrollHeight;
      if (cursor === words.length) finish();
      else timer = setTimeout(reveal, 42);
    };
    timer = setTimeout(reveal, 420);
  } else if (view.animateId) {
    const entry = view.history.find((item) => item.id === view.animateId);
    if (entry) view.onReplyComplete?.(entry.answer, entry.id);
  }
}
function trend(values: number[]) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 180 30");
  svg.setAttribute("class", "instrument-trend");
  svg.setAttribute("aria-hidden", "true");
  const points = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const lo = Math.min(...points),
    hi = Math.max(...points),
    span = hi - lo || 1;
  const line = document.createElementNS(svg.namespaceURI, "polyline");
  line.setAttribute(
    "points",
    points
      .map(
        (value, i) =>
          `${(i * 180) / (points.length - 1)},${26 - ((value - lo) * 22) / span}`,
      )
      .join(" "),
  );
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "currentColor");
  line.setAttribute("stroke-width", "1.5");
  line.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(line);
  return svg;
}
export function renderInstruments(
  host: HTMLElement,
  instruments: InstrumentView[],
  news: Bulletin[],
) {
  host.replaceChildren();
  host.className = "side-panel telemetry-panel";
  host.setAttribute("aria-label", "World reports");
  const rack = element("section", "instruments");
  rack.append(element("h2", "panel-title", "World state"));
  for (const instrument of instruments) {
    const row = element("div", `instrument ${instrument.kind}`);
    const label = element("div", "instrument-label");
    label.append(
      element("span", "", instrument.label),
      element("strong", "", instrument.display),
    );
    const bar = element("meter", "instrument-bar");
    bar.min = 0;
    bar.max = instrument.maximum;
    bar.value = instrument.value;
    bar.setAttribute(
      "aria-label",
      `${instrument.label}: ${instrument.display}. ${instrument.scale}`,
    );
    bar.title = instrument.scale;
    row.append(label);
    if (instrument.history && instrument.history.length > 1)
      row.append(trend(instrument.history));
    row.append(bar);
    rack.append(row);
  }
  if (instruments.length) host.append(rack);
  const feed = element("section", "news-feed");
  feed.setAttribute("aria-label", "News feed, newest first");
  feed.tabIndex = 0;
  const title = element("h3", "panel-title", "The wire");
  title.append(element("span", "wire-light"));
  feed.append(title);
  const entries = news
    .filter((item) => !item.id?.endsWith(":appointment-news"))
    .slice(-12)
    .reverse();
  if (!entries.length) {
    feed.append(element("p", "radio-idle", "Nothing to report."));
  }
  for (const item of entries) {
    const article = element("article", "bulletin");
    const source = element("div", "byline");
    const badge = element("span", "source-badge", item.source.slice(0, 1));
    badge.setAttribute("aria-hidden", "true");
    source.append(
      badge,
      element("strong", "", item.source),
      element("time", "", `Day ${item.day + 1}`),
    );
    article.append(source, element("p", "", item.headline));
    feed.append(article);
  }
  host.append(feed);
}
