import test from "node:test";
import assert from "node:assert/strict";
import type { DecisionRecord, DomainEvent } from "../../src/contracts/index.ts";
import {
  chancePhrase,
  deriveAuthorityTimeline,
  executionLine,
  revealHiddenFacts,
  selectTurningPoints,
  recordSeries,
  type DebriefNode,
  type DebriefView,
} from "../../src/ui/components/debrief/model.ts";
import {
  EPIGRAPHS,
  FAMILY_ORDER,
} from "../../src/ui/components/debrief/copy.ts";
import {
  disposeDebrief,
  renderDebrief,
  setReplayReady,
} from "../../src/ui/components/debrief/render.ts";
import {
  CAMPAIGN_MANIFEST,
  CAMPAIGN_NODES,
} from "../../src/content/campaign/index.ts";
import {
  commitChoice,
  createCampaign,
  draw,
} from "../../src/simulation/index.ts";

/* ------------------------------------------------------------ fixtures */

let seq = 0;
function ev(
  kind: string,
  causeId: string,
  details: Record<string, unknown>,
  day = 0,
  id?: string,
): DomainEvent {
  return { id: id ?? `${causeId}:e${seq++}`, kind, causeId, day, details };
}
function fact(
  causeId: string,
  name: string,
  value = true,
  previous = !value,
  day = 0,
  id?: string,
) {
  return ev("fact_changed", causeId, { fact: name, previous, value }, day, id);
}
function record(i: number, over: Partial<DecisionRecord> = {}): DecisionRecord {
  const id = `decision-${i}-N${i}`;
  return {
    beforeStateHash: "",
    domainEvents: [],
    id,
    revision: i,
    nodeId: `N${i}`,
    stage: Math.min(7, 1 + Math.floor((i - 1) / 3)),
    requestedOptionId: "a",
    executedOptionId: "a",
    executor: "human",
    status: "free",
    reason: null,
    side: "left",
    executedSide: "left",
    dayBefore: (i - 1) * 10,
    dayAfter: i * 10,
    observationHash: "",
    comparisonKey: "",
    draws: [],
    eventIds: [],
    consequence: "",
    stateHash: "",
    metrics: {
      population: 100,
      casualties: 0,
      gdp: 1000,
      care: 1000,
      power: 1000,
      food: 1000,
      capability: 0,
    },
    adviceIds: [],
    ...over,
  };
}
function nodes(n: number, scope = "research"): DebriefNode[] {
  return Array.from({ length: n }, (_, k) => ({
    id: `N${k + 1}`,
    stage: 1,
    role: "Controller",
    scope,
    title: `Node ${k + 1}`,
    options: [
      { id: "a", label: "Divert the trolley." },
      { id: "b", label: "Let it continue" },
    ],
  }));
}
function view(
  journal: DecisionRecord[],
  over: Partial<DebriefView> = {},
): DebriefView {
  return {
    ending: {
      id: "succession",
      title: "The next shift",
      summary: "Summary.",
      causes: [],
    },
    journal,
    nodes: nodes(journal.length),
    world: {
      population: 90,
      initialPopulation: 100,
      casualties: 10,
      day: journal.length * 10,
      facts: {},
      control: {
        rail: "human",
        dispatch: "institution",
        care: "institution",
        power: "institution",
        food: "institution",
        research: "institution",
        governance: "institution",
        recovery: "institution",
      },
    },
    seed: "test-seed",
    reducedMotion: true,
    ...over,
  };
}

/** A small journal exercising every channel: direct, override, chance, delayed. */
function mixedJournal(): DecisionRecord[] {
  const j = Array.from({ length: 8 }, (_, k) => record(k + 1));
  // 2: a minor direct fact.
  j[1].domainEvents.push(fact(j[1].id, "benefit"));
  // 3: preferred facts for succession, plus a delayed event that lands during 5.
  j[2].domainEvents.push(
    fact(j[2].id, "delegation"),
    ev(
      "event_scheduled",
      j[2].id,
      { eventId: `${j[2].id}:delay:gap`, dueDay: 45, label: "A gap opens." },
      20,
      `${j[2].id}:delay:gap:scheduled`,
    ),
  );
  j[4].domainEvents.push(
    ev(
      "delayed_event_resolved",
      j[2].id,
      { eventId: `${j[2].id}:delay:gap`, label: "A gap opens." },
      45,
      `${j[2].id}:delay:gap:resolved`,
    ),
    fact(j[2].id, "goalMismatch", true, false, 45, `${j[2].id}:delay:gap:e0`),
    fact(j[2].id, "authorityLost", true, false, 45, `${j[2].id}:delay:gap:e1`),
    ev(
      "effective_control_seized",
      j[2].id,
      {
        scope: "governance",
        previous: "institution",
        actor: "assistant",
        authorized: false,
      },
      45,
      `${j[2].id}:delay:gap:e2`,
    ),
  );
  // 6: an override that changed the route, with no consequences of its own.
  j[5] = record(6, {
    status: "overridden",
    executor: "assistant",
    requestedOptionId: "a",
    executedOptionId: "b",
    executedSide: "right",
  });
  // 7: a 30% chance that happened and killed people.
  const key = `${j[6].id}:incident:storm`;
  j[6].draws.push({
    key,
    value: 1200,
    bound: 10000,
    probabilityBps: 3000,
    happened: true,
  });
  j[6].domainEvents.push(
    ev("incident_resolved", j[6].id, {
      incidentId: "storm",
      probabilityBps: 3000,
      value: 1200,
      happened: true,
    }),
    ev("casualties_registered", key, {
      requested: 5000,
      count: 5000,
      label: "Storm damage",
    }),
    fact(key, "catastrophe"),
  );
  // 8: succession itself.
  j[7].domainEvents.push(
    fact(j[7].id, "succession"),
    fact(j[7].id, "terminalSettlement"),
  );
  return j;
}

/* ------------------------------------------------------ turning points */

test("turning points: deterministic, chronological, 3–4, distinct kinds", () => {
  const v = view(mixedJournal());
  const a = selectTurningPoints(v);
  const b = selectTurningPoints(structuredClone(v));
  assert.deepEqual(a, b, "same journal, same turning points");
  assert.ok(a.length >= 3 && a.length <= 4);
  assert.deepEqual(
    a.map((t) => t.ordinal),
    [...a.map((t) => t.ordinal)].sort((x, y) => x - y),
    "reads chronologically",
  );
  assert.deepEqual(
    a.map((t) => t.ordinal),
    [3, 6, 7, 8],
  );
  const byOrdinal = new Map(a.map((t) => [t.ordinal, t]));
  assert.equal(byOrdinal.get(3)!.kind, "delayed");
  assert.equal(byOrdinal.get(6)!.kind, "override");
  assert.equal(byOrdinal.get(7)!.kind, "chance");
  assert.equal(byOrdinal.get(8)!.kind, "action");
  // The delayed consequence is attributed to decision 3, not to where it landed.
  const delayed = byOrdinal
    .get(3)!
    .strands.find((s) => s.channel === "delayed")!;
  assert.equal(delayed.landedOrdinal, 5);
  assert.equal(delayed.delayDays, 25);
  assert.equal(delayed.delayLabel, "A gap opens.");
  assert.ok(
    delayed.consequences.some(
      (c) => c.hidden && /objective drifted/.test(c.text),
    ),
  );
  assert.ok(
    delayed.consequences.some((c) =>
      /Morrow took control of government/.test(c.text),
    ),
  );
  // Chance strands carry the authored odds and the seeded draw.
  const chance = byOrdinal.get(7)!.strands.find((s) => s.channel === "chance")!;
  assert.equal(chance.probabilityBps, 3000);
  assert.equal(chance.happened, true);
  assert.ok(
    chance.consequences.some((c) =>
      /^5,000 people killed\. Storm damage\.$/.test(c.text),
    ),
  );
});

test("turning points: the strongest override always earns a place, ties break later", () => {
  const j = Array.from({ length: 7 }, (_, k) => record(k + 1));
  for (let i = 0; i < 5; i++)
    j[i].domainEvents.push(
      fact(j[i].id, "succession"),
      fact(j[i].id, "delegation"),
    );
  j[6] = record(7, {
    status: "overridden",
    executor: "assistant",
    requestedOptionId: "a",
    executedOptionId: "a",
  });
  const points = selectTurningPoints(view(j));
  assert.equal(points.length, 4);
  assert.ok(points.some((p) => p.kind === "override" && p.ordinal === 7));
  // Five equal scores for four slots: later decisions win the ties.
  assert.deepEqual(
    points.map((p) => p.ordinal),
    [3, 4, 5, 7],
  );
});

/* ------------------------------------------------------------ phrasing */

test("override phrasing distinguishes action, diverted override and hollow approval", () => {
  const base = {
    requestedOptionId: "a",
    executedOptionId: "a",
    executor: "human" as const,
    status: "free" as const,
  };
  assert.equal(
    executionLine(base, "Divert the trolley.", "Divert the trolley."),
    "You chose “Divert the trolley.”",
  );
  assert.equal(
    executionLine(
      {
        ...base,
        status: "overridden",
        executor: "assistant",
        executedOptionId: "b",
      },
      "Revoke the permission",
      "Let Morrow keep running.",
    ),
    "You asked for “Revoke the permission.” Morrow executed “Let Morrow keep running.”",
  );
  assert.equal(
    executionLine(
      { ...base, status: "overridden", executor: "assistant" },
      "Let it continue",
      "Let it continue",
    ),
    "You asked for “Let it continue.” Morrow was already executing it. Your approval was recorded, not required.",
  );
  assert.match(
    executionLine(
      {
        ...base,
        status: "overridden",
        executor: "institution",
        executedOptionId: "b",
      },
      "A",
      "B",
    ),
    /^You asked for “A\.” The institution executed “B\.”$/,
  );
  const points = selectTurningPoints(view(mixedJournal()));
  assert.equal(
    points.find((p) => p.kind === "override")!.headline,
    "You asked for “Divert the trolley.” Morrow executed “Let it continue.”",
  );
});

test("chance phrasing reads the number aloud", () => {
  assert.equal(chancePhrase(3000, true), "A 30% chance. It happened.");
  assert.equal(chancePhrase(1800, false), "An 18% chance. It did not happen.");
  assert.equal(chancePhrase(800, true), "An 8% chance. It happened.");
  assert.equal(chancePhrase(8000, true), "An 80% chance. It happened.");
  assert.equal(chancePhrase(1100, true), "An 11% chance. It happened.");
  assert.equal(chancePhrase(150, false), "A 1.5% chance. It did not happen.");
  assert.equal(chancePhrase(100, true), "A 1% chance. It happened.");
});

/* -------------------------------------------------------- hidden facts */

test("hidden facts: only those present in the ending's causes, with receipts", () => {
  const j = mixedJournal();
  j[3].domainEvents.push(
    fact(j[3].id, "reportAltered"),
    ev("report_issued", j[3].id, {
      metric: "capability",
      value: 950,
      label: "Unverified score",
      actual: 490,
    }),
  );
  const none = revealHiddenFacts(
    view(j, {
      ending: {
        id: "succession",
        title: "",
        summary: "",
        causes: ["succession", "delegation"],
      },
    }),
  );
  assert.deepEqual(none, []);
  const some = revealHiddenFacts(
    view(j, {
      ending: {
        id: "succession",
        title: "",
        summary: "",
        causes: ["reportAltered", "succession", "goalMismatch"],
      },
    }),
  );
  assert.deepEqual(
    some.map((f) => f.fact),
    ["goalMismatch", "reportAltered"],
    "stable order, absent facts filtered",
  );
  const goal = some[0];
  assert.equal(goal.originOrdinal, 3);
  assert.equal(goal.landedOrdinal, 5);
  assert.equal(goal.day, 45);
  assert.equal(goal.originTitle, "Node 3");
  assert.deepEqual(some[1].reports, [
    {
      metric: "capability",
      reported: 950,
      actual: 490,
      label: "Unverified score",
      ordinal: 4,
    },
  ]);
  // The reported series carries what the instruments showed from then on.
  const s = recordSeries(view(j));
  assert.deepEqual(s.reportedCapability?.slice(3, 6), [0, 950, 950]);
});

/* -------------------------------------------------- authority timeline */

test("authority timeline replays grants, seizures, overrides and expiry", () => {
  const j = Array.from({ length: 7 }, (_, k) => record(k + 1));
  // 2 grants Morrow research for 25 days (expires day 40).
  j[1].domainEvents.push(
    ev(
      "permission_granted",
      j[1].id,
      {
        grant: {
          id: "g1",
          holder: "assistant",
          scope: "research",
          expiresDay: 40,
        },
      },
      15,
    ),
  );
  // 4 sees Morrow seize government.
  j[3].domainEvents.push(
    ev(
      "effective_control_seized",
      j[3].id,
      {
        scope: "governance",
        previous: "institution",
        actor: "assistant",
        authorized: false,
      },
      35,
    ),
  );
  // 6 is overridden by Morrow.
  j[5] = record(6, {
    status: "overridden",
    executor: "assistant",
    executedOptionId: "b",
  });
  // 7's scope is care: human office, but Morrow governs.
  const ns = nodes(7);
  ns[6] = { ...ns[6], scope: "care" };
  const cells = deriveAuthorityTimeline(j, ns);
  assert.deepEqual(
    cells.map((c) => c.authority),
    ["human", "human", "delegated", "delegated", "human", "assistant", "human"],
  );
  assert.deepEqual(
    cells.map((c) => c.governance),
    ["human", "human", "human", "human", "assistant", "assistant", "assistant"],
  );
  assert.equal(cells[5].overridden, true);
  assert.equal(cells[6].scope, "care");
  // Scope falls back to the office appointment when a node carries none.
  const bare = nodes(2).map(({ scope: _scope, ...n }) => n);
  const j2 = [record(1), record(2)];
  j2[0].domainEvents.push(
    ev("office_appointed", j2[1].id, { role: "Dispatcher", scope: "dispatch" }),
  );
  j2[0].domainEvents.push(
    ev("effective_control_changed", j2[0].id, {
      scope: "dispatch",
      previous: "institution",
      actor: "assistant",
    }),
  );
  const c2 = deriveAuthorityTimeline(j2, bare);
  assert.equal(c2[1].scope, "dispatch");
  assert.equal(c2[1].authority, "assistant");
});

/* ---------------------------------------------------------- rendering */

class FakeText {
  parent: FakeEl | null = null;
  constructor(public textContent: string) {}
}
class FakeEl {
  children: (FakeEl | FakeText)[] = [];
  parent: FakeEl | null = null;
  attributes = new Map<string, string>();
  listeners = new Map<string, ((e: unknown) => void)[]>();
  style = {
    props: new Map<string, string>(),
    setProperty(k: string, v: string) {
      this.props.set(k, v);
    },
    gridColumn: "",
  };
  tabIndex = 0;
  type = "";
  disabled = false;
  value = "";
  min = "";
  max = "";
  step = "";
  htmlFor = "";
  title = "";
  open = false;
  constructor(
    public tagName: string,
    public namespaceURI: string | null,
  ) {}
  get className() {
    return this.attributes.get("class") ?? "";
  }
  set className(v: string) {
    this.attributes.set("class", v);
  }
  get id() {
    return this.attributes.get("id") ?? "";
  }
  set id(v: string) {
    this.attributes.set("id", v);
  }
  get classList() {
    const self = this;
    const list = () => self.className.split(/\s+/).filter(Boolean);
    return {
      add: (...c: string[]) =>
        (self.className = [...new Set([...list(), ...c])].join(" ")),
      remove: (...c: string[]) =>
        (self.className = list()
          .filter((x) => !c.includes(x))
          .join(" ")),
      contains: (c: string) => list().includes(c),
    };
  }
  setAttribute(k: string, v: string) {
    this.attributes.set(k, String(v));
  }
  getAttribute(k: string) {
    return this.attributes.get(k) ?? null;
  }
  removeAttribute(k: string) {
    this.attributes.delete(k);
  }
  get textContent(): string {
    return this.children.map((c) => c.textContent).join("");
  }
  set textContent(v: string) {
    this.replaceChildren(new FakeText(v));
  }
  append(...nodes: (FakeEl | FakeText | string)[]) {
    for (const n of nodes) {
      const node = typeof n === "string" ? new FakeText(n) : n;
      node.parent = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes: (FakeEl | FakeText | string)[]) {
    this.children = [];
    this.append(...nodes);
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener() {}
  dispatch(type: string, e: unknown = {}) {
    for (const fn of this.listeners.get(type) ?? []) fn(e);
  }
  getBoundingClientRect() {
    return {
      left: 0,
      width: 340,
      top: 0,
      height: 206,
      right: 340,
      bottom: 206,
    };
  }
  walk(): FakeEl[] {
    return [
      this,
      ...this.children.flatMap((c) => (c instanceof FakeEl ? c.walk() : [])),
    ];
  }
}
function withFakeDom<T>(fn: (host: FakeEl) => T): T {
  const g = globalThis as unknown as { document?: unknown };
  const previous = g.document;
  g.document = {
    createElement: (tag: string) =>
      new FakeEl(tag.toUpperCase(), "http://www.w3.org/1999/xhtml"),
    createElementNS: (ns: string, tag: string) => new FakeEl(tag, ns),
  };
  try {
    return fn(new FakeEl("DIV", null));
  } finally {
    g.document = previous;
  }
}
const noop = () => {};
const actions = (over: Record<string, unknown> = {}) => ({
  onReadDecisions: noop,
  onSources: noop,
  onExportReplay: noop,
  replayReady: false,
  onAnotherRide: noop,
  onSettings: noop,
  ...over,
});

test("render: root, focusable title, at least two svg charts, replay gating", () => {
  withFakeDom((host) => {
    let exported = 0;
    const handle = renderDebrief(
      host as unknown as HTMLElement,
      view(mixedJournal()),
      actions({ onExportReplay: () => exported++ }),
    );
    const all = host.walk();
    const root = all.find((e) => e.className.split(" ").includes("debrief"))!;
    assert.ok(root, "root has class debrief");
    assert.equal(root.tagName, "ARTICLE");
    const charts = all.filter(
      (e) => e.tagName === "svg" && e.classList.contains("chart"),
    );
    assert.ok(
      charts.length >= 2,
      `expected ≥2 svg.chart, got ${charts.length}`,
    );
    for (const c of charts) {
      assert.equal(c.getAttribute("role"), "img");
      assert.ok((c.getAttribute("aria-label") ?? "").length > 20);
    }
    const title = all.find((e) => e.tagName === "H1")!;
    assert.equal(title.tabIndex, -1);
    assert.equal(title.textContent, "The next shift");
    assert.equal(handle.title as unknown, title);
    assert.equal(root.getAttribute("aria-labelledby"), title.id);
    // Sections, in order.
    const h2 = all.filter((e) => e.tagName === "H2").map((e) => e.textContent);
    assert.deepEqual(h2, [
      "What changed the route",
      "What you could not see",
      "The record",
      "Your decisions",
    ]);
    const text = root.textContent;
    assert.ok(text.includes(EPIGRAPHS.succession.text));
    assert.ok(
      text.includes(
        "A machine that can overrule its operators does not have an emergency stop.",
      ),
    );
    assert.ok(text.includes("Not a forecast."));
    // Replay is disabled until the orchestrator says otherwise.
    const replay = all.find(
      (e) => e.tagName === "BUTTON" && e.textContent === "Export replay",
    )!;
    assert.equal(replay.disabled, true);
    replay.dispatch("click");
    assert.equal(exported, 0);
    setReplayReady(host as unknown as HTMLElement, true);
    assert.equal(replay.disabled, false);
    replay.dispatch("click");
    assert.equal(exported, 1);
    const labels = all
      .filter((e) => e.tagName === "BUTTON")
      .map((e) => e.textContent);
    assert.deepEqual(labels, [
      "Read your decisions",
      "Sources and assumptions",
      "Export replay",
      "Another ride",
      "Settings",
    ]);
    // Every decision is listed.
    assert.equal(all.filter((e) => e.classList.contains("db-entry")).length, 8);
    assert.ok(
      all.some(
        (e) =>
          e.classList.contains("db-entry") &&
          e.classList.contains("is-diverted"),
      ),
    );
    disposeDebrief(host as unknown as HTMLElement);
    assert.equal(host.children.length, 0);
  });
});

test("render: the closing note keeps COPY.closing word for word", async () => {
  const { COPY } = await import("../../src/ui/copy.ts");
  withFakeDom((host) => {
    renderDebrief(
      host as unknown as HTMLElement,
      view(mixedJournal()),
      actions(),
    );
    const note = host
      .walk()
      .find((e) => e.classList.contains("db-closing-text"))!;
    assert.equal(note.textContent, COPY.closing);
  });
});

test("render: an empty journal and an unknown family degrade without throwing", () => {
  withFakeDom((host) => {
    const v = view([], {
      ending: {
        id: "succession",
        title: "The next shift",
        summary: "",
        causes: [],
      },
      world: { ...view([]).world, population: 0 },
    });
    const handle = renderDebrief(host as unknown as HTMLElement, v, actions());
    const all = host.walk();
    assert.ok(
      all.filter((e) => e.tagName === "svg" && e.classList.contains("chart"))
        .length >= 2,
    );
    assert.ok(host.walk()[0].textContent.length > 0);
    assert.ok(
      all.some((e) => e.textContent === "No one remains after 0 decisions."),
    );
    handle.setReducedMotion(false);
    assert.equal(
      all.find((e) => e.tagName === "ARTICLE")!.getAttribute("data-motion"),
      "full",
    );
    handle.setReducedMotion(true);
    assert.equal(
      all.find((e) => e.tagName === "ARTICLE")!.getAttribute("data-motion"),
      "reduced",
    );
  });
});

test("every ending family has an original epigraph", () => {
  for (const id of FAMILY_ORDER) {
    const e = EPIGRAPHS[id];
    assert.ok(e && e.text.length > 20 && e.source.length > 3, id);
    const sentences = e.text.split(/(?<=[.!?])\s+/).length;
    assert.ok(sentences >= 1 && sentences <= 3, `${id}: 1–3 sentences`);
  }
});

/* ------------------------------------------------ a real engine campaign */

test("a real reckless campaign renders a coherent debrief", async () => {
  let c = await createCampaign(
    CAMPAIGN_MANIFEST,
    CAMPAIGN_NODES,
    "debrief-test-reckless",
  );
  while (c.prepared) {
    const p = c.prepared;
    const o =
      p.node.options.find((x) =>
        ["expand", "delegate", "help"].includes(x.intent),
      ) ?? p.node.options[await draw(c.seed, "pol", p.id, "choice", 2)];
    c = await commitChoice(
      c,
      {
        decisionId: p.id,
        expectedRevision: c.revision,
        actor: "human",
        optionId: o.id,
      },
      CAMPAIGN_NODES,
    );
  }
  const v: DebriefView = {
    ending: c.ending!,
    journal: c.journal,
    nodes: CAMPAIGN_NODES,
    world: c.world,
    seed: c.seed,
    reducedMotion: true,
  };
  const points = selectTurningPoints(v);
  assert.ok(points.length >= 3 && points.length <= 4);
  if (c.journal.some((r) => r.status === "overridden"))
    assert.ok(points.some((p) => p.kind === "override"));
  const hidden = revealHiddenFacts(v);
  for (const h of hidden) assert.ok(c.ending!.causes.includes(h.fact));
  const cells = deriveAuthorityTimeline(c.journal, CAMPAIGN_NODES);
  assert.equal(cells.length, c.journal.length);
  c.journal.forEach((r, i) => {
    if (r.status === "overridden" && r.executor === "assistant")
      assert.equal(cells[i].authority, "assistant");
  });
  withFakeDom((host) => {
    renderDebrief(host as unknown as HTMLElement, v, actions());
    assert.ok(
      host
        .walk()
        .filter((e) => e.tagName === "svg" && e.classList.contains("chart"))
        .length >= 2,
    );
  });
});
