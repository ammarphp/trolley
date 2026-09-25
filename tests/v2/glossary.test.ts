import test from "node:test";
import assert from "node:assert/strict";
import registry from "../../research/registry/public-sources.json";
import { CAMPAIGN_NODES } from "../../src/content/campaign/index.ts";
import {
  GLOSSARY,
  findTermMatches,
  glossaryEntry,
  segmentText,
  sourceHost,
  wordCount,
  type GlossaryEntry,
} from "../../src/ui/content/glossary.ts";
import {
  BIBLIOGRAPHIC_LABEL,
  HISTORY_CARDS,
  historyCardFor,
} from "../../src/ui/content/history.ts";
import {
  annotate,
  DESCRIPTION_STORE_ID,
  descriptionId,
} from "../../src/ui/components/glossary/annotate.ts";
import { renderHistoryCard } from "../../src/ui/components/glossary/history-card.ts";

/* ------------------------------------------------------------------------
 * A minimal DOM: enough for annotate() and renderHistoryCard(). It is a
 * contract harness, not a browser; layout and the popover are verified in
 * the lab (src/ui/components/glossary/glossary.lab.ts).
 * --------------------------------------------------------------------- */
class FakeText {
  parent: FakeElement | FakeFragment | null = null;
  constructor(public textContent: string) {}
}
type Child = FakeElement | FakeText;
class FakeFragment {
  children: Child[] = [];
  append(...nodes: (Child | FakeFragment | string)[]) {
    for (const n of nodes) {
      if (n instanceof FakeFragment && !(n instanceof FakeElement)) {
        for (const c of n.children) this.children.push(c);
        n.children = [];
      } else this.children.push(typeof n === "string" ? new FakeText(n) : n);
    }
  }
  get textContent() {
    return this.children.map((c) => c.textContent).join("");
  }
}
class FakeElement extends FakeFragment {
  attributes = new Map<string, string>();
  dataset: Record<string, string> = {};
  listeners = new Map<string, (() => void)[]>();
  hidden = false;
  className = "";
  type = "";
  href = "";
  target = "";
  rel = "";
  id = "";
  htmlFor = "";
  tabIndex = -1;
  style: Record<string, string> = {};
  parent: FakeElement | null = null;
  constructor(
    public tagName: string,
    public ownerDocument: FakeDocument,
  ) {
    super();
  }
  override append(...nodes: (Child | FakeFragment | string)[]) {
    super.append(...nodes);
    for (const c of this.children)
      if (c instanceof FakeElement || c instanceof FakeText) c.parent = this;
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, String(value));
    if (name === "id") this.id = String(value);
  }
  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
  }
  removeAttribute(name: string) {
    this.attributes.delete(name);
  }
  addEventListener(type: string, fn: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  click() {
    for (const fn of this.listeners.get("click") ?? []) fn();
  }
  remove() {
    if (this.parent)
      this.parent.children = this.parent.children.filter((c) => c !== this);
  }
  override get textContent(): string {
    return this.children.map((c) => c.textContent).join("");
  }
  override set textContent(value: string) {
    this.children = [new FakeText(value)];
  }
  get classList() {
    const el = this;
    return {
      contains: (c: string) => el.className.split(/\s+/).includes(c),
    };
  }
  all(): FakeElement[] {
    const out: FakeElement[] = [];
    for (const c of this.children)
      if (c instanceof FakeElement) {
        out.push(c, ...c.all());
      }
    return out;
  }
}
class FakeDocument {
  body = new FakeElement("body", this);
  createDocumentFragment() {
    return new FakeFragment();
  }
  createElement(tag: string) {
    return new FakeElement(tag, this);
  }
  createTextNode(text: string) {
    return new FakeText(text);
  }
  getElementById(id: string): FakeElement | null {
    return this.body.all().find((e) => e.id === id) ?? null;
  }
}
const asDoc = (d: FakeDocument) => d as unknown as Document;
function buttonsOf(fragment: FakeFragment): FakeElement[] {
  return fragment.children.filter(
    (c): c is FakeElement => c instanceof FakeElement,
  );
}

/* ------------------------------------------------------------- content */

const REG = registry as unknown as {
  sources: { id: string; title: string; url: string | null }[];
  claims: { id: string; sourceIds: string[] }[];
};
const SOURCE_IDS = new Set(REG.sources.map((s) => s.id));
const NODE_IDS = new Set(CAMPAIGN_NODES.map((n) => n.id));

test("the glossary has 50 to 80 entries with unique ids", () => {
  assert.ok(
    GLOSSARY.length >= 50 && GLOSSARY.length <= 80,
    `${GLOSSARY.length} entries`,
  );
  assert.equal(new Set(GLOSSARY.map((e) => e.id)).size, GLOSSARY.length);
});

test("no entry exceeds the length limits", () => {
  for (const entry of GLOSSARY) {
    assert.ok(
      wordCount(entry.short) <= 40,
      `${entry.id} short is ${wordCount(entry.short)} words`,
    );
    if (entry.long)
      assert.ok(
        wordCount(entry.long) <= 120,
        `${entry.id} long is ${wordCount(entry.long)} words`,
      );
    assert.ok(entry.term.trim().length > 0);
  }
});

test("every sourceId exists in the research registry", () => {
  for (const entry of GLOSSARY)
    for (const id of entry.sourceIds ?? [])
      assert.ok(SOURCE_IDS.has(id), `${entry.id} cites unknown source ${id}`);
});

test("related ids resolve, and no surface form belongs to two entries", () => {
  const owner = new Map<string, string>();
  for (const entry of GLOSSARY) {
    for (const id of entry.related ?? []) {
      assert.ok(glossaryEntry(id), `${entry.id} relates to unknown ${id}`);
      assert.notEqual(id, entry.id, `${entry.id} relates to itself`);
    }
    const forms = [
      ...(entry.matchTerm === false ? [] : [entry.term]),
      ...entry.aliases,
    ];
    for (const form of forms) {
      const key = form
        .trim()
        .toLowerCase()
        .replace(/[\u2019]/g, "'")
        .replace(/[-\s]+/g, " ");
      const prior = owner.get(key);
      assert.ok(
        !prior || prior === entry.id,
        `"${form}" belongs to ${prior} and ${entry.id}`,
      );
      owner.set(key, entry.id);
    }
  }
});

test("registry sources render a readable host", () => {
  assert.equal(sourceHost("https://www.arxiv.org/pdf/1"), "arxiv.org");
  assert.equal(sourceHost(null), "");
  for (const s of REG.sources)
    if (s.url) assert.ok(sourceHost(s.url).includes("."), s.id);
});

/* ------------------------------------------------------------- matcher */

const TEST_ENTRIES: GlossaryEntry[] = [
  {
    id: "alpha",
    term: "red team",
    aliases: ["red-teaming"],
    short: "x",
    domain: "evidence",
  },
  { id: "beta", term: "team", aliases: [], short: "x", domain: "evidence" },
  {
    id: "gamma",
    term: "loop",
    aliases: ["the loop"],
    short: "x",
    domain: "ethics",
  },
  {
    id: "delta",
    term: "human in the loop",
    aliases: ["in the loop"],
    short: "x",
    domain: "governance",
  },
  {
    id: "eps",
    term: "alignment",
    aliases: ["aligned"],
    short: "x",
    domain: "safety",
    exclude: ["ecosystem alignment"],
  },
  {
    id: "zeta",
    term: "Goodhart's law",
    aliases: [],
    short: "x",
    domain: "safety",
  },
];

test("annotate wraps only the first occurrence of each term", () => {
  const doc = new FakeDocument();
  const frag = annotate(
    "The red team met. The red team left. Another team waited.",
    {
      document: asDoc(doc),
      entries: TEST_ENTRIES,
    },
  ) as unknown as FakeFragment;
  const buttons = buttonsOf(frag);
  assert.deepEqual(
    buttons.map((b) => [b.getAttribute("data-term"), b.textContent]),
    [
      ["alpha", "red team"],
      ["beta", "team"],
    ],
  );
  assert.equal(
    frag.textContent,
    "The red team met. The red team left. Another team waited.",
  );
});

test("annotate prefers the longest match and never nests", () => {
  const doc = new FakeDocument();
  const frag = annotate("Keep a human in the loop.", {
    document: asDoc(doc),
    entries: TEST_ENTRIES,
  }) as unknown as FakeFragment;
  const buttons = buttonsOf(frag);
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0]!.getAttribute("data-term"), "delta");
  assert.equal(buttons[0]!.textContent, "human in the loop");
  assert.equal(
    buttons[0]!.children.every((c) => c instanceof FakeText),
    true,
    "no element inside a term",
  );
});

test("annotate respects word boundaries", () => {
  const matches = findTermMatches(
    "Steamed loops, teammates and a teams meeting.",
    { entries: TEST_ENTRIES },
  );
  // "loops" is the plural of loop; "teams" the plural of team; "teammates" and "Steamed" are not terms.
  assert.deepEqual(
    matches.map((m) => [m.id, m.text]),
    [
      ["gamma", "loops"],
      ["beta", "teams"],
    ],
  );
});

test("annotate is alias-aware across case, hyphens and apostrophes", () => {
  const found = findTermMatches(
    "RED-TEAMING helps. Goodhart’s Law applies. Is it ALIGNED?",
    { entries: TEST_ENTRIES },
  );
  assert.deepEqual(
    found.map((m) => [m.id, m.text]),
    [
      ["alpha", "RED-TEAMING"],
      ["zeta", "Goodhart’s Law"],
      ["eps", "ALIGNED"],
    ],
  );
  const spaced = findTermMatches("a red   team", { entries: TEST_ENTRIES });
  assert.equal(spaced[0]?.id, "alpha");
});

test("exclusions and already-seen phrases consume their text", () => {
  const ex = findTermMatches(
    "They call it ecosystem alignment. Is it aligned?",
    { entries: TEST_ENTRIES },
  );
  assert.deepEqual(
    ex.map((m) => m.text),
    ["aligned"],
  );
  const seen = new Set<string>(["delta"]);
  const shadow = findTermMatches("Nobody in the loop. Then the loop.", {
    entries: TEST_ENTRIES,
    seen,
  });
  // "in the loop" belongs to delta (seen): it is consumed, so gamma matches only the later "the loop".
  assert.equal(shadow.length, 1);
  assert.equal(shadow[0]!.id, "gamma");
  assert.equal(shadow[0]!.start, "Nobody in the loop. Then ".length);
});

test("seen is shared across calls and max limits one call", () => {
  const doc = new FakeDocument();
  const seen = new Set<string>();
  const first = annotate("A red team and a team.", {
    document: asDoc(doc),
    entries: TEST_ENTRIES,
    seen,
  }) as unknown as FakeFragment;
  const second = annotate("The red team again, and a loop.", {
    document: asDoc(doc),
    entries: TEST_ENTRIES,
    seen,
  }) as unknown as FakeFragment;
  assert.equal(buttonsOf(first).length, 2);
  assert.deepEqual(
    buttonsOf(second).map((b) => b.getAttribute("data-term")),
    ["gamma"],
  );
  assert.deepEqual([...seen].sort(), ["alpha", "beta", "gamma"]);
  const capped = annotate("red team, team, loop", {
    document: asDoc(doc),
    entries: TEST_ENTRIES,
    max: 1,
  }) as unknown as FakeFragment;
  assert.equal(buttonsOf(capped).length, 1);
});

test("term buttons are described by one hidden definition store", () => {
  const doc = new FakeDocument();
  const frag = annotate("A standing order, then another standing order.", {
    document: asDoc(doc),
  }) as unknown as FakeFragment;
  const [button] = buttonsOf(frag);
  assert.ok(button);
  assert.equal(button.tagName, "button");
  assert.equal(button.type, "button");
  assert.equal(button.className, "term");
  assert.equal(button.getAttribute("data-term"), "standing-order");
  assert.equal(
    button.getAttribute("aria-describedby"),
    descriptionId("standing-order"),
  );
  assert.equal(button.getAttribute("aria-expanded"), "false");
  const store = doc.getElementById(DESCRIPTION_STORE_ID)!;
  assert.ok(store.hidden);
  const description = doc.getElementById(descriptionId("standing-order"))!;
  assert.match(description.textContent, /^Standing order: /);
  annotate("standing order", { document: asDoc(doc) });
  assert.equal(store.children.length, 1, "descriptions are not duplicated");
});

test("real campaign text round-trips and yields no overlapping matches", () => {
  for (const node of CAMPAIGN_NODES) {
    const texts = [node.prompt, ...node.advice.map((a) => a.answer)];
    const seen = new Set<string>();
    for (const text of texts) {
      const segments = segmentText(text, { seen });
      assert.equal(segments.map((s) => s.text).join(""), text, node.id);
      const matches = findTermMatches(text);
      for (let i = 1; i < matches.length; i++)
        assert.ok(matches[i]!.start >= matches[i - 1]!.end, node.id);
    }
  }
});

test("known false friends stay plain", () => {
  const cases: [string, string | null][] = [
    ["She points out the error.", null],
    ["Five people are trapped beyond the points.", "points"],
    ["The audit packet does not show you the loops.", null],
    [
      "Vela's investor-relations lead calls the structure 'ecosystem alignment.'",
      null,
    ],
    ["A station footbridge with stairs.", null],
  ];
  for (const [text, expected] of cases) {
    const ids = findTermMatches(text).map((m) => m.id);
    if (expected === null) assert.deepEqual(ids, [], text);
    else assert.ok(ids.includes(expected), text);
  }
  const s403 = CAMPAIGN_NODES.find((n) => n.id === "S4-03")!;
  assert.deepEqual(
    findTermMatches(s403.prompt).map((m) => m.id),
    ["latent-reasoning", "chain-of-thought", "standing-order"],
  );
});

/* ------------------------------------------------------------- history */

test("every node id in history.ts exists in the campaign, once", () => {
  const ids = HISTORY_CARDS.map((c) => c.nodeId);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(NODE_IDS.has(id), `unknown node ${id}`);
  assert.equal(historyCardFor("S2-01")?.title, "The switch");
  assert.equal(historyCardFor("nope"), null);
});

test("every classical stage-2 node and every node with research claims has a card", () => {
  for (const node of CAMPAIGN_NODES) {
    if (node.stage === 2)
      assert.ok(historyCardFor(node.id), `stage-2 node ${node.id} has no card`);
    if (node.claimIds.length)
      assert.ok(historyCardFor(node.id), `${node.id} has claims but no card`);
  }
});

test("cards cite the registry sources behind their node's claims", () => {
  for (const node of CAMPAIGN_NODES) {
    const card = historyCardFor(node.id);
    if (!card || !node.claimIds.length) continue;
    const cited = new Set(
      card.references.map((r) => r.registryId).filter(Boolean),
    );
    for (const claimId of node.claimIds) {
      const claim = REG.claims.find((c) => c.id === claimId);
      assert.ok(claim, `${node.id}: unknown claim ${claimId}`);
      for (const sourceId of claim.sourceIds)
        assert.ok(cited.has(sourceId), `${node.id} omits ${sourceId}`);
    }
  }
});

test("history references are honest about their verification", () => {
  for (const card of HISTORY_CARDS) {
    for (const ref of card.references) {
      if (ref.verified === "registry") {
        assert.ok(
          ref.registryId && SOURCE_IDS.has(ref.registryId),
          `${card.nodeId}: ${ref.citation}`,
        );
        const title = REG.sources.find((s) => s.id === ref.registryId)!.title;
        assert.ok(
          ref.citation.includes(title),
          `${card.nodeId}: citation must repeat the registry title "${title}"`,
        );
      } else {
        assert.equal(ref.verified, "bibliographic");
        assert.equal(
          ref.registryId,
          undefined,
          `${card.nodeId}: bibliographic references carry no registry id`,
        );
        assert.ok(
          ref.year,
          `${card.nodeId}: bibliographic references need a year`,
        );
      }
    }
    if (!card.references.some((r) => r.verified === "registry"))
      assert.ok(card.note, `${card.nodeId} needs an evidence note`);
  }
});

test("no history card exceeds the length limits", () => {
  for (const card of HISTORY_CARDS) {
    assert.ok(
      wordCount(card.lineage) <= 120,
      `${card.nodeId} lineage is ${wordCount(card.lineage)} words`,
    );
    assert.ok(
      wordCount(card.distinction) <= 20,
      `${card.nodeId} distinction is ${wordCount(card.distinction)} words`,
    );
    if (card.adaptation)
      assert.ok(wordCount(card.adaptation) <= 50, `${card.nodeId} adaptation`);
  }
});

test("renderHistoryCard is a working disclosure with labelled references", () => {
  const doc = new FakeDocument();
  const host = doc.createElement("div");
  const card = historyCardFor("S2-01")!;
  const toggles: boolean[] = [];
  const handle = renderHistoryCard(host as unknown as HTMLElement, card, {
    onToggle: (v) => toggles.push(v),
  });
  const nodes = (host as FakeElement).all();
  const toggle = nodes.find((n) => n.className === "ghc-toggle")!;
  const body = nodes.find((n) => n.className === "ghc-body")!;
  assert.equal(toggle.getAttribute("aria-expanded"), "false");
  assert.equal(toggle.getAttribute("aria-controls"), body.id);
  assert.equal(body.hidden, true);
  toggle.click();
  assert.equal(toggle.getAttribute("aria-expanded"), "true");
  assert.equal(body.hidden, false);
  assert.equal(handle.expanded, true);
  assert.deepEqual(toggles, [true]);
  const links = nodes.filter((n) => n.tagName === "a");
  assert.ok(links.length >= 3);
  for (const a of links) {
    assert.equal(a.target, "_blank");
    assert.equal(a.rel, "noopener noreferrer");
  }
  const text = (host as FakeElement).textContent;
  assert.ok(
    text.includes(BIBLIOGRAPHIC_LABEL) ||
      text.includes("Not in project registry"),
  );
  assert.ok(text.includes("In project registry"));
  assert.ok(
    nodes.some((n) => n.className === "term" && n.getAttribute("data-term")),
    "lineage terms are annotated",
  );
  handle.destroy();
  assert.equal((host as FakeElement).children.length, 0);
});
