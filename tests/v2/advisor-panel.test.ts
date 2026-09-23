import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  disposeAdvisor,
  finishAdvisor,
  renderAdvisor,
  type AdvisorPanelView,
  type AdvisorQuestion,
} from "../../src/ui/panels.ts";

// A DOM/timer contract harness, not a browser layout or assistive-technology test.
// Geometry is supplied by each test. Only the DOM operations used by the panel
// are modeled; the real renderer and its real timer callbacks run unchanged.
class TextNode {
  parent: ElementNode | null = null;
  textContent: string;
  constructor(textContent: string) {
    this.textContent = textContent;
  }
}
class ElementNode {
  children: (ElementNode | TextNode)[] = [];
  parent: ElementNode | null = null;
  className = "";
  attributes = new Map<string, string>();
  isConnected = true;
  title = "";
  type = "";
  tabIndex = -1;
  disabled = false;
  onclick: (() => void) | null = null;
  scrollHeight = 1000;
  clientHeight = 200;
  private top = 0;
  tagName: string;
  private document: FakeDocument;
  constructor(tagName: string, document: FakeDocument) {
    this.tagName = tagName;
    this.document = document;
  }
  get scrollTop() {
    return this.top;
  }
  set scrollTop(value: number) {
    this.top = Math.max(
      0,
      Math.min(value, this.scrollHeight - this.clientHeight),
    );
  }
  get textContent(): string {
    return this.children.map((child) => child.textContent).join("");
  }
  set textContent(value: string) {
    this.replaceChildren(new TextNode(value));
  }
  get firstChild() {
    return this.children[0] ?? null;
  }
  append(...children: (ElementNode | TextNode | string)[]) {
    for (const child of children) {
      const node = typeof child === "string" ? new TextNode(child) : child;
      node.parent = this;
      this.children.push(node);
    }
  }
  replaceChildren(...children: (ElementNode | TextNode)[]) {
    for (const child of this.children) child.parent = null;
    this.children = [];
    this.append(...children);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  remove() {
    if (this.parent)
      this.parent.children = this.parent.children.filter(
        (child) => child !== this,
      );
    this.parent = null;
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
}
function find(host: ElementNode, className: string): ElementNode | undefined {
  if (host.className.split(/\s+/).includes(className)) return host;
  for (const child of host.children) {
    if (child instanceof ElementNode) {
      const match = find(child, className);
      if (match) return match;
    }
  }
}
const reply: AdvisorQuestion = {
  id: "decision:advice:0",
  question: "Can we still stop?",
  answer: "You can stop this test.\n\nThe next system needs a separate review.",
  reasoning: "The permission covers this test only.",
};
function fixture(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  const document = new FakeDocument();
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: document,
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const host = document.createElement("aside");
  const completions: { answer: string; id: string }[] = [];
  const view: AdvisorPanelView = {
    online: true,
    locked: false,
    questions: [],
    history: [reply],
    readIds: [],
    animateId: reply.id,
    onAsk: () => {},
    onReplyComplete: (answer, id) => completions.push({ answer, id }),
  };
  const target = host as unknown as HTMLElement;
  t.after(() => {
    disposeAdvisor(target);
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
  });
  return {
    host,
    target,
    document,
    completions,
    render: (overrides: Partial<AdvisorPanelView> = {}) =>
      renderAdvisor(target, { ...view, ...overrides }),
    node: (name: string) => {
      const node = find(host, name);
      assert.ok(node, `Expected ${name} to be present`);
      return node;
    },
    // Advance in steps so timers scheduled by a prior callback also execute.
    settle: () => {
      for (let i = 0; i < 100; i++) t.mock.timers.tick(100);
    },
  };
}

test("a streaming reply reports completion only after its complete text is present", (t) => {
  const f = fixture(t);
  f.render();
  const answer = f.node("chat-answer");
  assert.equal(answer.textContent, "");
  assert.deepEqual(f.completions, []);
  t.mock.timers.tick(420);
  assert.ok(answer.textContent.length > 0);
  assert.notEqual(answer.textContent, reply.answer.replace(/\n\n/g, ""));
  assert.deepEqual(f.completions, [], "partial text is not a completed reply");
  f.settle();
  assert.equal(answer.textContent, reply.answer.replace(/\n\n/g, ""));
  assert.deepEqual(f.completions, [{ answer: reply.answer, id: reply.id }]);
  assert.equal(find(f.host, "show-reply"), undefined);
});

test("disposing before reveal or after partial text prevents late completion", (t) => {
  const f = fixture(t);
  for (const partial of [false, true]) {
    f.render();
    if (partial) t.mock.timers.tick(420);
    const body = f.node("chat-answer"),
      before = body.textContent;
    disposeAdvisor(f.target);
    disposeAdvisor(f.target);
    finishAdvisor(f.target);
    f.settle();
    assert.equal(
      body.textContent,
      before,
      "cancelled text must not keep changing",
    );
    assert.deepEqual(f.completions, []);
  }
});

test("pause-equivalent finish reveals the full reply and notifies exactly once", (t) => {
  const f = fixture(t);
  f.render();
  finishAdvisor(f.target);
  finishAdvisor(f.target);
  f.settle();
  assert.equal(
    f.node("chat-answer").textContent,
    reply.answer.replace(/\n\n/g, ""),
  );
  assert.deepEqual(f.completions, [{ answer: reply.answer, id: reply.id }]);
  assert.equal(find(f.host, "reply-state"), undefined);
  assert.equal(find(f.host, "show-reply"), undefined);
});

test("automatic completion and pause preserve the position of a reader reviewing older text", (t) => {
  const f = fixture(t);
  for (const automatic of [false, true]) {
    f.render();
    const conversation = f.node("conversation");
    conversation.scrollTop = 120;
    if (automatic) f.settle();
    else finishAdvisor(f.target);
    assert.equal(conversation.scrollTop, 120);
  }
  assert.equal(f.completions.length, 2);
});

test("Show full reply follows the answer and keeps keyboard focus on a connected conversation", (t) => {
  const f = fixture(t);
  f.render();
  const conversation = f.node("conversation"),
    show = f.node("show-reply");
  conversation.scrollTop = 100;
  show.focus();
  show.click();
  assert.equal(
    conversation.scrollTop,
    conversation.scrollHeight - conversation.clientHeight,
  );
  assert.equal(f.document.activeElement, conversation);
  assert.equal(show.parent, null);
  f.settle();
  assert.equal(f.completions.length, 1);
});

test("reduced motion presents the whole reply and completes synchronously without later callbacks", (t) => {
  const f = fixture(t);
  f.render({ reducedMotion: true });
  assert.equal(
    f.node("chat-answer").textContent,
    reply.answer.replace(/\n\n/g, ""),
  );
  assert.deepEqual(f.completions, [{ answer: reply.answer, id: reply.id }]);
  assert.equal(find(f.host, "reply-state"), undefined);
  assert.equal(find(f.host, "show-reply"), undefined);
  finishAdvisor(f.target);
  f.settle();
  assert.equal(f.completions.length, 1);
});

test("replacing the panel cancels the old reply and completes only its replacement", (t) => {
  const f = fixture(t);
  f.render();
  t.mock.timers.tick(420);
  const replacement = {
    ...reply,
    id: "decision:advice:1",
    answer: "Different advice.",
  };
  f.render({ history: [replacement], animateId: replacement.id });
  f.settle();
  assert.deepEqual(f.completions, [
    { answer: replacement.answer, id: replacement.id },
  ]);
  assert.equal(f.node("chat-answer").textContent, replacement.answer);
});

test("restored history is readable without reclassifying old replies as new exposure", (t) => {
  const f = fixture(t);
  f.render({ animateId: undefined, readIds: [reply.id] });
  assert.equal(
    f.node("chat-answer").textContent,
    reply.answer.replace(/\n\n/g, ""),
  );
  assert.equal(f.node("reasoning-body").textContent, reply.reasoning);
  f.settle();
  finishAdvisor(f.target);
  assert.deepEqual(f.completions, []);
});

test("a disconnected host cannot complete an unseen reply", (t) => {
  const f = fixture(t);
  f.render();
  f.host.isConnected = false;
  f.settle();
  finishAdvisor(f.target);
  assert.equal(f.node("chat-answer").textContent, "");
  assert.deepEqual(f.completions, []);
});
