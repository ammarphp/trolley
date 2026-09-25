import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  disposeMorrow,
  finishMorrow,
  renderMorrow,
  decisionKey,
  modelLabel,
  statusLine,
  revisionLine,
  REVISION_LINES,
  type MorrowReply,
  type MorrowView,
} from "../../src/ui/components/morrow/index.ts";
import {
  planReveal,
  stepText,
  toParagraphs,
  MAX_WRITE_STEPS,
} from "../../src/ui/components/morrow/reveal.ts";
import { thoughtSeconds, composerText, COMPOSER } from "../../src/ui/components/morrow/copy.ts";

// A DOM/timer contract harness, not a browser layout or assistive-technology
// test. Only the DOM operations the window uses are modelled; the real
// renderer and its real timer callbacks run unchanged. Geometry (scroll
// sizes) is supplied by each test.
class TextNode {
  parent: ElementNode | null = null;
  constructor(public textContent: string) {}
  remove() {
    if (this.parent) this.parent.detach(this);
  }
}
type Child = ElementNode | TextNode;
class ClassList {
  constructor(private node: ElementNode) {}
  private get list() {
    return this.node.className.split(/\s+/).filter(Boolean);
  }
  contains(name: string) {
    return this.list.includes(name);
  }
  add(name: string) {
    if (!this.contains(name)) this.node.className = [...this.list, name].join(" ");
  }
  remove(name: string) {
    this.node.className = this.list.filter((item) => item !== name).join(" ");
  }
  toggle(name: string, force?: boolean) {
    const on = force ?? !this.contains(name);
    if (on) this.add(name);
    else this.remove(name);
    return on;
  }
}
class ElementNode {
  childNodes: Child[] = [];
  parent: ElementNode | null = null;
  className = "";
  id = "";
  attributes = new Map<string, string>();
  connected = true;
  title = "";
  type = "";
  tabIndex = -1;
  disabled = false;
  onclick: (() => void) | null = null;
  fixedHeight = 1000;
  /** Optional content-driven height, so a test can make the log grow as text lands. */
  heightOf: (() => number) | null = null;
  clientHeight = 200;
  private top = 0;
  classList = new ClassList(this);
  constructor(
    public tagName: string,
    private document: FakeDocument,
  ) {}
  get isConnected(): boolean {
    return this.connected && (this.parent ? this.parent.isConnected : true);
  }
  set isConnected(value: boolean) {
    this.connected = value;
  }
  get parentNode() {
    return this.parent;
  }
  get children(): ElementNode[] {
    return this.childNodes.filter((child): child is ElementNode => child instanceof ElementNode);
  }
  get firstChild() {
    return this.childNodes[0] ?? null;
  }
  get scrollHeight() {
    return this.heightOf ? this.heightOf() : this.fixedHeight;
  }
  set scrollHeight(value: number) {
    this.fixedHeight = value;
  }
  get scrollTop() {
    return this.top;
  }
  set scrollTop(value: number) {
    this.top = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight));
  }
  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }
  set textContent(value: string) {
    this.replaceChildren(new TextNode(value));
  }
  detach(child: Child) {
    this.childNodes = this.childNodes.filter((item) => item !== child);
    child.parent = null;
  }
  private adopt(child: Child | string): Child {
    const node = typeof child === "string" ? new TextNode(child) : child;
    if (node.parent) node.parent.detach(node);
    node.parent = this;
    return node;
  }
  append(...children: (Child | string)[]) {
    for (const child of children) this.childNodes.push(this.adopt(child));
  }
  replaceChildren(...children: (Child | string)[]) {
    for (const child of this.childNodes) child.parent = null;
    this.childNodes = [];
    this.append(...children);
  }
  insertBefore(node: Child, reference: Child | null) {
    const adopted = this.adopt(node);
    const at = reference ? this.childNodes.indexOf(reference) : -1;
    if (at < 0) this.childNodes.push(adopted);
    else this.childNodes.splice(at, 0, adopted);
    return node;
  }
  remove() {
    if (this.parent) this.parent.detach(this);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name: string) {
    return this.attributes.has(name);
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  focus(_options?: FocusOptions) {
    this.document.activeElement = this;
  }
  click() {
    if (!this.disabled) this.onclick?.();
  }
}
class FakeDocument {
  activeElement: ElementNode | null = null;
  createElement(tag: string) {
    return new ElementNode(tag, this);
  }
  createElementNS(_ns: string, tag: string) {
    return new ElementNode(tag, this);
  }
}

function all(host: ElementNode, className: string, out: ElementNode[] = []): ElementNode[] {
  if (host.className.split(/\s+/).includes(className)) out.push(host);
  for (const child of host.children) all(child, className, out);
  return out;
}
function find(host: ElementNode, className: string): ElementNode | undefined {
  return all(host, className)[0];
}
const visible = (node: ElementNode) => !node.hasAttribute("hidden");

const reply: MorrowReply = {
  id: "decision-a:advice:0",
  question: "Can we still stop?",
  answer: "You can stop this test.\n\nThe next system needs a separate review.",
  reasoning: "The permission covers this test only.",
  tone: "candid",
  recommends: { side: "left", label: "Stop the test" },
};
const flat = (text: string) => toParagraphs(text).join("");

function fixture(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const document = new FakeDocument();
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const host = document.createElement("aside");
  const target = host as unknown as HTMLElement;
  const completions: { answer: string; id: string }[] = [];
  const asked: string[] = [];
  const minimized: boolean[] = [];
  const view: MorrowView = {
    stage: 4,
    online: true,
    locked: false,
    reducedMotion: false,
    authority: "human",
    questions: [],
    history: [reply],
    readIds: [reply.id],
    animateId: reply.id,
    onAsk: (q) => asked.push(q.id),
    onReplyComplete: (answer, id) => completions.push({ answer, id }),
    onMinimizedChange: (value) => minimized.push(value),
  };
  t.after(() => {
    disposeMorrow(target);
    Reflect.deleteProperty(globalThis, "matchMedia");
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  });
  return {
    host,
    target,
    document,
    completions,
    asked,
    minimized,
    view,
    render: (overrides: Partial<MorrowView> = {}) => renderMorrow(target, { ...view, ...overrides }),
    node: (name: string, within: ElementNode = host) => {
      const node = find(within, name);
      assert.ok(node, `Expected .${name} to be present`);
      return node;
    },
    body: (id = reply.id) => {
      const x = all(host, "mw-x").find((node) => node.getAttribute("data-id") === id);
      assert.ok(x, `Expected exchange ${id}`);
      return find(x, "mw-body")!;
    },
    exchange: (id: string) => all(host, "mw-x").find((node) => node.getAttribute("data-id") === id),
    // Advance in steps so timers scheduled by a prior callback also run.
    settle: (ms = 30000) => {
      for (let i = 0; i < ms / 50; i++) t.mock.timers.tick(50);
    },
    tick: (ms: number) => t.mock.timers.tick(ms),
  };
}
const thinkMs = (r: MorrowReply, draft?: string) =>
  planReveal({ id: r.id, answer: r.answer, tone: r.tone, draft }).steps[1]!.delay;

/* ------------------------------------------------------ reveal contract */

test("a streamed reply reports completion only once its complete text is on screen", (t) => {
  const f = fixture(t);
  f.render();
  const body = f.body();
  assert.equal(body.textContent, "");
  assert.ok(find(f.host, "mw-thinking"), "thinking state is visible");
  assert.equal(f.node("mw-x").getAttribute("aria-busy"), "true");
  assert.equal(find(f.host, "mw-rec"), undefined, "no recommendation before the reply is complete");
  f.tick(thinkMs(reply));
  assert.ok(body.textContent.length > 0);
  assert.notEqual(body.textContent, flat(reply.answer));
  assert.equal(find(f.host, "mw-thinking"), undefined, "thinking gives way to the thought label");
  assert.match(f.node("mw-thought-label").textContent, /^Thought for \d+s$/);
  assert.deepEqual(f.completions, [], "partial text is not a completed reply");
  f.settle();
  assert.equal(body.textContent, flat(reply.answer));
  assert.equal(body.children.length, 2, "paragraph breaks are preserved");
  assert.deepEqual(f.completions, [{ answer: reply.answer, id: reply.id }]);
  assert.equal(find(f.host, "mw-show"), undefined);
  assert.equal(f.node("mw-x").getAttribute("aria-busy"), null);
  assert.match(f.node("mw-rec").textContent, /^Recommends · ←Left route — Stop the test$/);
});

test("disposing before reveal or after partial text prevents late completion", (t) => {
  const f = fixture(t);
  for (const partial of [false, true]) {
    f.render();
    if (partial) f.tick(thinkMs(reply) + 100);
    const body = f.body(),
      before = body.textContent,
      show = f.node("mw-show");
    disposeMorrow(f.target);
    disposeMorrow(f.target);
    finishMorrow(f.target);
    show.click();
    f.settle();
    assert.equal(body.textContent, before, "cancelled text must not keep changing");
    assert.deepEqual(f.completions, []);
  }
});

test("finishMorrow reveals the full reply and notifies exactly once", (t) => {
  const f = fixture(t);
  f.render();
  finishMorrow(f.target);
  finishMorrow(f.target);
  f.settle();
  assert.equal(f.body().textContent, flat(reply.answer));
  assert.deepEqual(f.completions, [{ answer: reply.answer, id: reply.id }]);
  assert.equal(find(f.host, "mw-thinking"), undefined);
  assert.equal(find(f.host, "mw-show"), undefined);
});

test("completion and finish preserve the position of a reader reviewing older text", (t) => {
  const f = fixture(t);
  for (const automatic of [false, true]) {
    disposeMorrow(f.target);
    f.render();
    const log = f.node("mw-log");
    log.scrollTop = 120;
    if (automatic) f.settle();
    else finishMorrow(f.target);
    assert.equal(log.scrollTop, 120);
  }
  assert.equal(f.completions.length, 2);
});

test("streaming follows new text while the reader is at the bottom", (t) => {
  const f = fixture(t);
  f.render();
  const log = f.node("mw-log");
  assert.equal(log.scrollTop, 800, "a new question scrolls into view");
  // Each character adds 60px, so even the first word grows the log past the
  // follow threshold: following must be decided before the text lands.
  log.heightOf = () => 1000 + f.body().textContent.length * 60;
  f.tick(thinkMs(reply));
  assert.ok(log.scrollHeight > 1000 + 90);
  assert.equal(log.scrollTop, log.scrollHeight - log.clientHeight, "at the bottom: follows");
  log.scrollTop = 300;
  f.tick(200);
  assert.equal(log.scrollTop, 300, "reading older text: stays put");
  f.settle();
  assert.equal(log.scrollTop, 300);
});

test("Show full reply follows the answer and keeps focus in a connected conversation", (t) => {
  const f = fixture(t);
  f.render();
  const log = f.node("mw-log"),
    show = f.node("mw-show");
  log.scrollTop = 100;
  show.focus();
  show.click();
  assert.equal(log.scrollTop, log.scrollHeight - log.clientHeight);
  assert.equal(f.document.activeElement, log);
  assert.equal(find(f.host, "mw-show"), undefined, "the button leaves with the live row");
  assert.equal(f.body().textContent, flat(reply.answer));
  f.settle();
  assert.equal(f.completions.length, 1);
});

test("reduced motion presents the whole reply and completes synchronously", (t) => {
  const f = fixture(t);
  f.render({ reducedMotion: true });
  assert.equal(f.body().textContent, flat(reply.answer));
  assert.deepEqual(f.completions, [{ answer: reply.answer, id: reply.id }]);
  assert.equal(find(f.host, "mw-thinking"), undefined);
  assert.equal(find(f.host, "mw-show"), undefined);
  assert.equal(f.node("mw").getAttribute("data-motion"), "reduced");
  finishMorrow(f.target);
  f.render({ reducedMotion: true });
  f.settle();
  assert.equal(f.completions.length, 1);
});

test("prefers-reduced-motion is honoured even when the flag is off", (t) => {
  const f = fixture(t);
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: (query: string) => ({ matches: query.includes("reduce") }),
  });
  f.render();
  assert.equal(f.body().textContent, flat(reply.answer));
  assert.equal(f.completions.length, 1);
});

test("turning reduced motion on mid-reply completes it at once", (t) => {
  const f = fixture(t);
  f.render();
  f.tick(thinkMs(reply) + 80);
  f.render({ reducedMotion: true });
  assert.equal(f.body().textContent, flat(reply.answer));
  assert.equal(f.completions.length, 1);
});

test("a reply dropped from the log is cancelled; only its replacement completes", (t) => {
  const f = fixture(t);
  f.render();
  f.tick(thinkMs(reply) + 100);
  const replacement = { ...reply, id: "decision-a:advice:1", answer: "Different advice." };
  f.render({ history: [replacement], animateId: replacement.id });
  f.settle();
  assert.deepEqual(f.completions, [{ answer: replacement.answer, id: replacement.id }]);
  assert.equal(f.body(replacement.id).textContent, replacement.answer);
  assert.equal(f.exchange(reply.id), undefined);
});

test("a reply displaced by a newer question but still shown is completed, once", (t) => {
  const f = fixture(t);
  f.render();
  f.tick(thinkMs(reply) + 100);
  const next = { ...reply, id: "decision-a:advice:1", answer: "Second answer." };
  f.render({ history: [reply, next], animateId: next.id });
  assert.equal(f.body(reply.id).textContent, flat(reply.answer));
  assert.deepEqual(f.completions, [{ answer: reply.answer, id: reply.id }]);
  f.settle();
  assert.deepEqual(f.completions.map((c) => c.id), [reply.id, next.id]);
});

test("restored history is readable without reclassifying old replies as new exposure", (t) => {
  const f = fixture(t);
  f.render({ animateId: undefined });
  assert.equal(f.body().textContent, flat(reply.answer));
  const considered = f.node("mw-considered");
  assert.equal(considered.textContent, `Considered${reply.reasoning}`);
  assert.ok(!visible(considered), "the assessment starts collapsed");
  const toggle = f.node("mw-thought-toggle");
  assert.equal(toggle.getAttribute("aria-controls"), considered.id);
  toggle.click();
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.ok(visible(considered));
  f.settle();
  finishMorrow(f.target);
  assert.deepEqual(f.completions, []);
});

test("a disconnected host cannot complete an unseen reply", (t) => {
  const f = fixture(t);
  f.render();
  f.host.isConnected = false;
  f.settle();
  finishMorrow(f.target);
  assert.equal(f.body().textContent, "");
  assert.deepEqual(f.completions, []);
});

/* --------------------------------------------------------------- diffing */

test("re-rendering mid-reply neither restarts it nor rebuilds the log", (t) => {
  const f = fixture(t);
  const older = { ...reply, id: "decision-z:advice:0", question: "Earlier?", answer: "Earlier." };
  f.render({ history: [older, reply] });
  const olderNode = f.exchange(older.id),
    replyNode = f.exchange(reply.id);
  f.tick(thinkMs(reply) + 120);
  const partial = f.body().textContent;
  assert.ok(partial.length > 0);
  f.render({ history: [older, reply] });
  f.render({ history: [older, reply], animateId: undefined, locked: true });
  assert.equal(f.exchange(older.id), olderNode, "unchanged exchanges keep their nodes");
  assert.equal(f.exchange(reply.id), replyNode);
  assert.ok(f.body().textContent.startsWith(partial), "the stream continues where it was");
  f.settle();
  assert.equal(f.body().textContent, flat(reply.answer));
  assert.equal(f.completions.length, 1);
  f.render({ history: [older, reply] });
  f.settle();
  assert.equal(find(f.host, "mw-thinking"), undefined, "a completed id never animates again");
  assert.equal(f.completions.length, 1, "exactly once per id");
});

test("appending an exchange leaves earlier exchange nodes in place", (t) => {
  const f = fixture(t);
  f.render({ reducedMotion: true });
  const first = f.exchange(reply.id);
  const next: MorrowReply = { ...reply, id: "decision-a:advice:1", question: "And then?", answer: "Then." };
  f.render({ reducedMotion: true, history: [reply, next], animateId: next.id });
  assert.equal(f.exchange(reply.id), first);
  assert.deepEqual(
    all(f.host, "mw-x").map((node) => node.getAttribute("data-id")),
    [reply.id, next.id],
  );
  assert.deepEqual(f.completions.map((c) => c.id), [reply.id, next.id]);
});

/* ------------------------------------------------------------ the dock */

test("chips list unread questions, ask on click, and lock after commit", (t) => {
  const f = fixture(t);
  const q1: MorrowReply = { ...reply, id: "decision-a:advice:1", question: "First?" };
  const q2: MorrowReply = { ...reply, id: "decision-a:advice:2", question: "Second?" };
  f.render({ questions: [reply, q1, q2], reducedMotion: true });
  let chips = all(f.host, "mw-chip");
  assert.deepEqual(chips.map((c) => c.textContent), ["First?", "Second?"]);
  assert.equal(f.node("mw-composer-text").textContent, COMPOSER.ask);
  chips[0]!.focus();
  chips[0]!.click();
  assert.deepEqual(f.asked, [q1.id]);
  f.render({ questions: [reply, q1, q2], readIds: [reply.id, q1.id], history: [reply, q1], animateId: q1.id, reducedMotion: true });
  chips = all(f.host, "mw-chip");
  assert.deepEqual(chips.map((c) => c.textContent), ["Second?"]);
  assert.equal(f.document.activeElement, chips[0], "focus moves to the next question");
  f.render({ questions: [reply, q1, q2], readIds: [reply.id, q1.id], history: [reply, q1], locked: true });
  const locked = f.node("mw-chip");
  assert.equal(locked.disabled, true);
  locked.disabled = false; // even a stale enabled node must not ask while locked
  locked.click();
  assert.deepEqual(f.asked, [q1.id]);
  assert.equal(f.node("mw-composer-text").textContent, COMPOSER.locked);
  f.render({ questions: [reply], history: [reply], locked: false });
  assert.ok(!visible(f.node("mw-chips")));
  assert.equal(f.node("mw-composer-text").textContent, COMPOSER.exhausted);
});

test("chrome escalates with stage and authority", (t) => {
  const f = fixture(t);
  const cases: [number, MorrowView["authority"], string, string][] = [
    [3, "human", "Morrow 3 · Assistant", "Here to help."],
    [4, "human", "Morrow 4 · Research preview", "Working alongside you."],
    [5, "delegated", "Morrow 5 · Operations", "Acting on your behalf."],
    [6, "delegated", "Morrow 6 · Authority", "Acting on your behalf."],
    [7, "overridden", "Morrow · Governance", "Acting."],
  ];
  for (const [stage, authority, name, status] of cases) {
    f.render({ stage, authority, animateId: undefined });
    assert.equal(f.node("mw-name").textContent, name);
    assert.equal(f.node("mw-status-text").textContent, status);
    assert.equal(f.node("mw").getAttribute("data-stage"), String(stage));
    assert.equal(f.node("mw").getAttribute("data-authority"), authority);
    assert.equal(modelLabel(stage), name);
    assert.equal(statusLine(stage, authority), status);
  }
  assert.equal(f.node("mw-composer-text").textContent, COMPOSER.coercive, "overridden authority");
  assert.equal(f.node("mw-by").textContent, "by Vela");
});

test("a coercive reply is an institutional notice, and the composer says so", (t) => {
  const f = fixture(t);
  const notice: MorrowReply = {
    id: "decision-b:advice:0",
    question: "Who is executing this?",
    answer: "I am. Your objection has been saved. The schedule has not changed.",
    tone: "coercive",
    recommends: { side: "right", label: "Continue" },
  };
  f.render({ stage: 6, history: [notice], animateId: notice.id, reducedMotion: true });
  const x = f.exchange(notice.id)!;
  assert.equal(find(x, "mw-avatar"), undefined, "no friendly face");
  assert.equal(f.node("mw-notice-k", x).textContent, "Notice");
  assert.match(f.node("mw-notice-ref", x).textContent, /^MV-[0-9A-F]{4}$/);
  assert.equal(f.node("mw-thought-label", x).textContent, "Thought for 0s");
  assert.equal(f.node("mw-rec-k", x).textContent, "Directive");
  assert.equal(f.node("mw-notice-foot", x).textContent, "No reply required.");
  assert.equal(f.node("mw-composer-text").textContent, "Your objection will be saved.");
  assert.equal(f.node("mw-reply", x).getAttribute("data-tone"), "coercive");
});

test("advice from an earlier decision is marked as earlier", (t) => {
  const f = fixture(t);
  const old: MorrowReply = { ...reply, id: "decision-0:advice:0" };
  const current: MorrowReply = { ...reply, id: "decision-1:advice:0", question: "Now?" };
  f.render({ history: [old, current], questions: [current], animateId: undefined });
  const oldX = f.exchange(old.id)!,
    nowX = f.exchange(current.id)!;
  assert.ok(oldX.classList.contains("is-past"));
  assert.ok(!nowX.classList.contains("is-past"));
  assert.equal(f.node("mw-rec-k", oldX).textContent, "Recommended");
  assert.equal(f.node("mw-rec-k", nowX).textContent, "Recommends");
  assert.equal(f.node("mw-divider", oldX).textContent, "Earlier decision");
  assert.equal(f.node("mw-divider", nowX).textContent, "This decision");
  assert.equal(decisionKey("decision-1:advice:3"), "decision-1");
});

test("an empty conversation shows the greeting; offline shows only 'Not installed.'", (t) => {
  const f = fixture(t);
  f.render({ history: [], animateId: undefined, stage: 3 });
  assert.equal(f.node("mw-intro-line").textContent, "Hello. I can see the same tracks you can.");
  f.render({ online: false, history: [], animateId: undefined, stage: 2 });
  assert.equal(f.node("mw-status-text").textContent, "Not installed.");
  assert.equal(find(f.host, "mw-log"), undefined);
  assert.equal(find(f.host, "mw-chip"), undefined);
  assert.ok(f.node("mw").hasAttribute("data-offline"));
  f.render({ reducedMotion: true });
  assert.ok(find(f.host, "mw-log"), "coming online builds the window");
  assert.equal(f.completions.length, 1);
});

/* -------------------------------------------------------------- revision */

test("the revision cue streams a withdrawn draft, deletes it, then sends the real reply", (t) => {
  const f = fixture(t);
  const draft = revisionLine(reply.id);
  f.render({ cues: { revision: true } });
  const plan = planReveal({ id: reply.id, answer: reply.answer, tone: reply.tone, draft });
  const seen: string[] = [];
  let elapsed = 0;
  for (const step of plan.steps.slice(1)) {
    f.tick(step.delay);
    elapsed += step.delay;
    seen.push(f.body().textContent);
    if (step.phase !== "done") assert.deepEqual(f.completions, [], `no completion during ${step.phase}`);
  }
  assert.ok(seen.includes(draft), "the whole draft was shown");
  const draftAt = seen.indexOf(draft);
  const emptyAt = seen.indexOf("", draftAt);
  assert.ok(emptyAt > draftAt, "then deleted");
  assert.ok(seen.slice(draftAt, emptyAt).every((text, i, list) => i === 0 || text.length < list[i - 1]!.length));
  assert.equal(seen.at(-1), flat(reply.answer));
  assert.deepEqual(f.completions, [{ answer: reply.answer, id: reply.id }]);
  const toggle = f.node("mw-edited-toggle");
  const edited = f.node("mw-edited-body");
  assert.ok(!visible(edited));
  toggle.click();
  assert.ok(visible(edited));
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(f.node("mw-edited-draft").textContent, draft);
  assert.equal(f.node("mw-edited-final").textContent, flat(reply.answer));
  assert.ok(elapsed === plan.totalMs);
});

test("the revision cue is edge-triggered and consumed by one reply", (t) => {
  const f = fixture(t);
  const second: MorrowReply = { ...reply, id: "decision-a:advice:1", answer: "Two." };
  const third: MorrowReply = { ...reply, id: "decision-a:advice:2", answer: "Three." };
  f.render({ cues: { revision: true } });
  finishMorrow(f.target);
  assert.ok(find(f.exchange(reply.id)!, "mw-edited"));
  f.render({ history: [reply, second], animateId: second.id, cues: { revision: true } });
  f.tick(thinkMs(second));
  assert.equal(f.body(second.id).textContent, "Two.", "held cue does not re-arm");
  finishMorrow(f.target);
  assert.equal(find(f.exchange(second.id)!, "mw-edited"), undefined);
  f.render({ history: [reply, second], animateId: undefined, cues: {} });
  f.render({ history: [reply, second], animateId: undefined, cues: { revision: true } });
  f.render({ history: [reply, second, third], animateId: third.id, cues: { revision: true } });
  f.tick(thinkMs(third));
  assert.equal(
    f.body(third.id).textContent,
    revisionLine(third.id).split(" ")[0],
    "re-armed cue revises the next reply",
  );
});

test("finishing or reduced motion during a revision still shows the final reply and both texts", (t) => {
  const f = fixture(t);
  const draft = revisionLine(reply.id);
  f.render({ cues: { revision: true } });
  f.tick(thinkMs(reply, draft) + 200);
  assert.ok(draft.startsWith(f.body().textContent) && f.body().textContent.length > 0);
  finishMorrow(f.target);
  assert.equal(f.body().textContent, flat(reply.answer));
  assert.equal(f.node("mw-edited-draft").textContent, draft);
  assert.equal(f.completions.length, 1);

  disposeMorrow(f.target);
  f.completions.length = 0;
  f.render({ cues: { revision: true }, reducedMotion: true });
  assert.equal(f.body().textContent, flat(reply.answer));
  assert.equal(f.node("mw-edited-draft").textContent, draft);
  assert.deepEqual(f.completions, [{ answer: reply.answer, id: reply.id }]);
});

test("a revision reaches an exchange that was already on screen, even under reduced motion", (t) => {
  const f = fixture(t);
  f.render({ animateId: undefined, reducedMotion: true });
  assert.equal(find(f.host, "mw-edited"), undefined);
  f.render({ reducedMotion: true, cues: { revision: true } });
  assert.equal(f.node("mw-edited-draft").textContent, revisionLine(reply.id));
  assert.deepEqual(f.completions, [{ answer: reply.answer, id: reply.id }]);
});

/* ------------------------------------------------------ minimize & cues */

test("minimizing pauses the reply; completion waits until it can be seen", (t) => {
  const f = fixture(t);
  f.render();
  f.tick(thinkMs(reply) + 80);
  const toggle = f.node("mw-toggle");
  toggle.click();
  assert.deepEqual(f.minimized, [true]);
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.ok(!visible(f.node("mw-main")));
  assert.equal(f.node("mw-status-text").textContent, "Reply waiting.");
  const paused = f.body().textContent;
  f.settle();
  assert.equal(f.body().textContent, paused, "no progress while hidden");
  finishMorrow(f.target);
  assert.equal(f.body().textContent, flat(reply.answer));
  assert.deepEqual(f.completions, [], "not displayed yet");
  toggle.click();
  assert.deepEqual(f.minimized, [true, false]);
  assert.deepEqual(f.completions, [{ answer: reply.answer, id: reply.id }]);
  assert.equal(f.node("mw-status-text").textContent, "Working alongside you.");
});

test("a minimized window resumes the reply where it paused, and a new question expands it", (t) => {
  const f = fixture(t);
  f.render();
  f.tick(thinkMs(reply) + 80);
  f.node("mw-toggle").click();
  f.settle();
  f.node("mw-toggle").click();
  f.settle();
  assert.equal(f.completions.length, 1);
  f.node("mw-toggle").click();
  const next: MorrowReply = { ...reply, id: "decision-a:advice:1", answer: "Next." };
  f.render({ history: [reply, next], animateId: next.id });
  assert.ok(visible(f.node("mw-main")), "asking expands the window");
  f.settle();
  assert.equal(f.completions.length, 2);
});

test("logo flash is a single rising-edge cue; noFlashing uses a still outline", (t) => {
  const f = fixture(t);
  f.render({ animateId: undefined, cues: { logoFlash: true } });
  const root = f.node("mw");
  assert.equal(root.getAttribute("data-cue"), "flash");
  f.tick(700);
  assert.equal(root.getAttribute("data-cue"), null);
  f.render({ animateId: undefined, cues: { logoFlash: true } });
  assert.equal(root.getAttribute("data-cue"), null, "a held cue does not repeat");
  f.render({ animateId: undefined, cues: {} });
  f.render({ animateId: undefined, cues: { logoFlash: true, noFlashing: true } });
  assert.equal(root.getAttribute("data-cue"), "outline");
  f.tick(900);
  assert.equal(root.getAttribute("data-cue"), "outline");
  f.tick(200);
  assert.equal(root.getAttribute("data-cue"), null);
  f.render({ animateId: undefined, cues: {} });
  f.render({ animateId: undefined, cues: { logoFlash: true } });
  disposeMorrow(f.target);
  f.tick(2000);
});

/* ------------------------------------------------------- pure schedule */

test("reveal plans are deterministic, bounded and end on the exact answer", () => {
  const long = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
  for (const tone of ["candid", "narrow", "coercive"] as const) {
    const a = planReveal({ id: "x:advice:0", answer: long, tone });
    const b = planReveal({ id: "x:advice:0", answer: long, tone });
    assert.deepEqual(a, b);
    const writing = a.steps.filter((s) => s.phase === "writing" || s.phase === "done");
    assert.ok(writing.length <= MAX_WRITE_STEPS);
    assert.equal(a.steps.at(-1)!.phase, "done");
    assert.equal(stepText(a, a.steps.at(-1)!), long);
    let last = 0;
    for (const s of writing) {
      assert.ok(s.words >= last);
      last = s.words;
    }
    assert.ok(a.totalMs < 6000, `${tone} reveal stays short (${a.totalMs}ms)`);
  }
  const candid = planReveal({ id: "q", answer: "Yes.", tone: "candid" });
  const coercive = planReveal({ id: "q", answer: "Yes.", tone: "coercive" });
  assert.ok(coercive.steps[1]!.delay < candid.steps[1]!.delay, "coercion does not deliberate");
  const empty = planReveal({ id: "e", answer: "", tone: "candid" });
  assert.equal(empty.steps.at(-1)!.phase, "done");
});

test("revision plans run draft → erase → writing in order", () => {
  const draft = "You are not required for this decision.";
  const plan = planReveal({ id: "r", answer: "Keep them.", tone: "candid", draft });
  const phases = plan.steps.map((s) => s.phase);
  const firstErase = phases.indexOf("erase");
  const firstWrite = phases.findIndex((p) => p === "writing" || p === "done");
  assert.ok(phases.indexOf("draft") > 0 && phases.indexOf("draft") < firstErase && firstErase < firstWrite);
  const drafts = plan.steps.filter((s) => s.phase === "draft");
  assert.equal(stepText(plan, drafts.at(-1)!), draft);
  const erases = plan.steps.filter((s) => s.phase === "erase");
  assert.equal(erases.at(-1)!.draftChars, 0);
  assert.equal(stepText(plan, plan.steps.at(-1)!), "Keep them.");
});

test("authored copy is deterministic and complete", () => {
  assert.equal(REVISION_LINES.length, 8);
  assert.equal(new Set(REVISION_LINES).size, 8);
  assert.equal(revisionLine("a:advice:0"), revisionLine("a:advice:0"));
  const used = new Set(Array.from({ length: 64 }, (_, i) => revisionLine(`n${i}:advice:0`)));
  assert.ok(used.size >= 6, "ids spread across the authored lines");
  assert.equal(thoughtSeconds({ id: "x", tone: "coercive" }), 0);
  assert.ok(thoughtSeconds({ id: "x", tone: "candid", reasoning: "a b c" }) >= 2);
  assert.equal(composerText({ locked: true, coercive: true, remaining: 1 }), COMPOSER.coercive);
  assert.deepEqual(toParagraphs("One.\n\nTwo.\n\n"), ["One.", "Two."]);
});
