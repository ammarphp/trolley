import test from "node:test";
import assert from "node:assert/strict";
import type { NewsItem } from "../../src/contracts/index.ts";
import {
  inferSeverity,
  inferTopic,
  normalizeTickerLines,
  parseClock,
  relativeAge,
  tickerText,
  toWireItems,
  toWireView,
  wireFactoid,
  wireTickerLines,
  withClock,
} from "../../src/ui/components/wire/normalize.ts";
import {
  buildWireEntries,
  phraseKey,
  representedCount,
  saturationLevels,
} from "../../src/ui/components/wire/saturation.ts";
import {
  reconcileKeyed,
  type KeyedHost,
} from "../../src/ui/components/wire/keyed.ts";
import {
  detailLine,
  postStamp,
  similarLabel,
} from "../../src/ui/components/wire/details.ts";
import type {
  AmbientFeedItemLike,
  WireItem,
} from "../../src/ui/components/wire/types.ts";

const news = (
  id: string,
  day: number,
  source: NewsItem["source"],
  headline: string,
): NewsItem => ({
  id,
  day,
  headline,
  source,
  entityId: "common-rail",
  causeId: `cause-${id}`,
});

const post = (
  id: string,
  day: number,
  text: string,
  extra: Partial<AmbientFeedItemLike> = {},
): AmbientFeedItemLike => ({
  id,
  kind: "post",
  authorHandle: `h_${id}`,
  authorName: `Name ${id}`,
  topic: "",
  text,
  dateLabel: `DAY ${day + 1} · 10:${String(day % 60).padStart(2, "0")}`,
  day,
  isBot: false,
  engagement: 100,
  severity: 0,
  ...extra,
});

const bot = (id: string, day: number, text: string) =>
  post(id, day, text, { isBot: true });

/* ------------------------------------------------------------ normalization */

test("engine news normalizes to typed, prefixed, newest-first cards", () => {
  const items = toWireItems([
    news(
      "a:appointment-news",
      0,
      "Authority",
      "Common Rail appoints you as junior controller.",
    ),
    news("b", 1, "Ledger", "Investors question delays."),
    news(
      "c",
      1,
      "Relay",
      "Drone swarm grounds corridor; 14 dead as signals fail.",
    ),
    news("d", 3, "Authority", "Common Rail suspends manual override."),
    news("e", 4, "Morrow", "Human confirmation is no longer required."),
  ]);
  assert.deepEqual(
    items.map((i) => i.id),
    ["news:e", "news:d", "news:c", "news:b"],
    "appointment notice is hidden by default; order is newest first",
  );
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  assert.equal(byId["news:b"]!.kind, "headline");
  assert.equal(byId["news:b"]!.source.name, "The Ledger");
  assert.equal(byId["news:c"]!.kind, "headline");
  assert.equal(byId["news:c"]!.severity, 2);
  assert.equal(byId["news:c"]!.breaking, true);
  assert.equal(byId["news:d"]!.kind, "statement");
  assert.equal(byId["news:d"]!.source.kind, "official");
  assert.equal(byId["news:e"]!.kind, "morrow");
  assert.equal(byId["news:e"]!.source.name, "Morrow");
  assert.equal(byId["news:b"]!.causeId, "cause-b");
  for (const item of items) {
    assert.match(item.dateLabel, /^DAY \d+ · \d{2}:\d{2}$/);
    assert.equal(item.origin, "engine");
    assert.equal(item.isBot, false);
  }
  // Same-day reports keep causal order in their seeded clocks.
  assert.ok(byId["news:c"]!.minute! > byId["news:b"]!.minute!);

  const withAppointments = toWireItems(
    [news("a:appointment-news", 0, "Authority", "Appointed.")],
    [],
    {
      includeAppointments: true,
    },
  );
  assert.equal(withAppointments.length, 1);
});

test("normalization is deterministic and honours options", () => {
  const input = [
    news("x", 10, "Ledger", "Vela closes a $40bn round."),
    news("y", 12, "Relay", "Grid operator cuts power."),
  ];
  const a = toWireItems(input, [], { causeLabel: (id) => `Follows ${id}` });
  const b = toWireItems(input, [], { causeLabel: (id) => `Follows ${id}` });
  assert.deepEqual(a, b);
  assert.equal(a[1]!.causeLabel, "Follows cause-x");
  const cal = toWireItems(input, [], { epoch: "2031-03-01" });
  assert.match(cal[0]!.dateLabel, /^13 MAR 2031 · \d{2}:\d{2}$/);
  assert.equal(toWireItems(input, [], { limit: 1 }).length, 1);
});

test("ambient items normalize: posts, breaking, statements, Morrow; ticker and factoid are not cards", () => {
  const ambient: AmbientFeedItemLike[] = [
    post("p1", 5, "Hospital generators on backup.", { engagement: 1000 }),
    {
      id: "b1",
      kind: "breaking",
      outletId: "meridian",
      outletName: "The Meridian",
      topic: "grid",
      text: "Nationwide outage",
      dateLabel: "DAY 6 · 08:30",
      day: 5,
      isBot: false,
      severity: 0,
    },
    {
      id: "s1",
      kind: "statement",
      outletId: "ostra-interior",
      topic: "civic",
      text: "Curfew in effect.",
      dateLabel: "DAY 6 · 21:00",
      day: 5,
      isBot: false,
      severity: 0,
      nationId: "ostra",
    },
    {
      id: "m1",
      kind: "post",
      authorHandle: "@morrow",
      topic: "",
      text: "Routing restored.",
      dateLabel: "DAY 6 · 07:00",
      day: 5,
      isBot: true,
      severity: 0,
    },
    {
      id: "t1",
      kind: "ticker",
      topic: "",
      text: "VELA ▲ 4%",
      dateLabel: "",
      isBot: false,
      severity: 0,
    },
    {
      id: "f1",
      kind: "factoid",
      topic: "",
      text: "Grid load 94%.",
      dateLabel: "",
      isBot: false,
      severity: 0,
    },
    post("p1", 5, "duplicate id is dropped"),
  ];
  const items = toWireItems([], ambient);
  const ids = items.map((i) => i.id).sort();
  assert.deepEqual(ids, ["b1", "m1", "p1", "s1"]);
  const p1 = items.find((i) => i.id === "p1")!;
  assert.equal(p1.kind, "post");
  assert.equal(p1.source.handle, "h_p1");
  assert.equal(p1.source.kind, "person");
  assert.equal(p1.engagement!.likes, 1000);
  assert.ok(p1.engagement!.reposts > 0 && p1.engagement!.reposts < 1000);
  assert.equal(p1.text, "Hospital generators on backup.");
  const b1 = items.find((i) => i.id === "b1")!;
  assert.equal(b1.severity, 2);
  assert.equal(b1.breaking, true);
  assert.equal(b1.source.name, "The Meridian");
  const s1 = items.find((i) => i.id === "s1")!;
  assert.equal(s1.kind, "statement");
  assert.equal(s1.source.nationId, "ostra");
  const m1 = items.find((i) => i.id === "m1")!;
  assert.equal(m1.kind, "morrow");
  assert.equal(m1.isBot, false, "Morrow is not counted as a bot");
});

test("lexical guesses: topic and severity", () => {
  assert.equal(
    inferTopic(
      "Vela declares safety milestone. New system receives powers the test never covered.",
    ),
    "lab",
  );
  assert.equal(
    inferTopic("Grid operator cuts power to four districts"),
    "grid",
  );
  assert.equal(inferTopic("Vela investors question delays"), "markets");
  assert.equal(
    inferTopic("Ambulance reaches hospital after AI finds a clear route."),
    "health",
  );
  assert.equal(inferSeverity("14 dead as signals fail"), 2);
  assert.equal(inferSeverity("Vela IPO cancelled"), 1);
  assert.equal(inferSeverity("Patients leave clinic"), 0);
});

test("clock helpers and relative ages", () => {
  assert.equal(parseClock("DAY 12 · 08:14"), 494);
  assert.equal(parseClock("no clock"), null);
  assert.equal(withClock("DAY 12 · 08:14", 19 * 60 + 44), "DAY 12 · 19:44");
  assert.equal(withClock("DAY 12", 61), "DAY 12 · 01:01");
  assert.equal(relativeAge(10, 10), "Today");
  assert.equal(relativeAge(9, 10), "Yesterday");
  assert.equal(relativeAge(7, 10), "3 days ago");
  assert.equal(relativeAge(10, 100), "3 months ago");
  assert.equal(relativeAge(0, 800), "2 years ago");
  assert.equal(relativeAge(null, 3), null);
});

/* ------------------------------------------------------------ saturation */

function botFlood(
  n: number,
  text: (i: number) => string,
  dayOf = (i: number) => 10 + (i % 3),
) {
  return toWireItems(
    [],
    Array.from({ length: n }, (_, i) => bot(`bot${i}`, dayOf(i), text(i))),
  );
}

test("phrase keys ignore case, punctuation, digits, mentions and hashtags", () => {
  assert.equal(
    phraseKey("Incredible momentum at Vela!"),
    phraseKey("incredible   momentum at vela."),
  );
  assert.equal(
    phraseKey("@a 42 Nothing is wrong #calm"),
    phraseKey("Nothing is wrong. calm"),
  );
  assert.notEqual(
    phraseKey("Nothing is wrong."),
    phraseKey("Something is wrong."),
  );
});

test("identical phrasing groups into one entry; the flood only grows with saturation", () => {
  const items = botFlood(
    8,
    () => "Grateful for stability. Grateful for Morrow.",
  );
  const calm = buildWireEntries(items, 0);
  assert.equal(calm.length, 1);
  assert.equal(calm[0]!.similar, 7, "honest count with no saturation");
  assert.equal(calm[0]!.members.length, 8);
  assert.equal(representedCount(calm), 8);
  const late = buildWireEntries(items, 0.9);
  assert.equal(late.length, 1);
  assert.ok(late[0]!.similar > 7, "flood sample implies more copies at 0.9");
  assert.equal(similarLabel(1), "and 1 similar post");
  assert.equal(similarLabel(214), "and 214 similar posts");
  // Deterministic.
  assert.deepEqual(buildWireEntries(items, 0.9), late);
});

test("group key is stable when a new duplicate arrives; the newest copy becomes the face", () => {
  const first = toWireItems(
    [],
    [
      bot("b1", 10, "Nothing is wrong."),
      post("h1", 11, "Is anyone else seeing this?"),
    ],
  );
  const before = buildWireEntries(first, 0.5);
  const key = before.find((e) => e.item.text === "Nothing is wrong.")!.key;
  assert.equal(key, "b1");
  const second = toWireItems(
    [],
    [
      bot("b1", 10, "Nothing is wrong."),
      post("h1", 11, "Is anyone else seeing this?"),
      bot("b2", 12, "Nothing is wrong!"),
    ],
  );
  const after = buildWireEntries(second, 0.5);
  const group = after.find((e) => e.key === key)!;
  assert.ok(group, "same key after the duplicate arrives");
  assert.equal(group.item.id, "b2");
  assert.equal(after[0]!.key, key, "the group bubbles to the top");
});

test("fuzzy near-duplicates group only from 0.5 saturation", () => {
  const items = toWireItems(
    [],
    [
      bot(
        "n1",
        10,
        "Authorities have everything under control. Stay calm and follow official guidance.",
      ),
      bot(
        "n2",
        11,
        "Authorities have everything under control. Please stay calm and follow official guidance.",
      ),
    ],
  );
  assert.equal(buildWireEntries(items, 0.3).length, 2);
  assert.equal(buildWireEntries(items, 0.6).length, 1);
  assert.equal(saturationLevels(0.49).fuzzy, false);
});

test("saturation is subtle at 0.3 and unmistakable at 0.9", () => {
  const items = botFlood(
    60,
    (i) =>
      `Distinct automated post number ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))} about the weather.`,
  );
  const humans = toWireItems(
    [],
    Array.from({ length: 40 }, (_, i) =>
      post(
        `hu${i}`,
        9,
        `Independent voice ${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))} says something different.`,
      ),
    ),
  );
  const count = (s: number) => {
    const entries = buildWireEntries([...items, ...humans], s);
    const bots = entries.filter((e) => e.item.isBot);
    const people = entries.filter((e) => !e.item.isBot);
    return {
      faces: bots.filter((e) => e.collapsedAvatar).length,
      times: bots.filter((e) => e.collapsedTime).length,
      badges: entries.filter((e) => e.verified).length,
      thinned: people.filter((e) => e.thinned).length,
      botThinned: bots.filter((e) => e.thinned).length,
      bots: bots.length,
      total: entries.length,
      people: people.length,
    };
  };
  const zero = count(0);
  assert.equal(zero.faces, 0);
  assert.equal(zero.times, 0);
  assert.equal(zero.badges, 0);
  assert.equal(zero.thinned, 0);

  const subtle = count(0.3);
  assert.ok(
    subtle.faces > 0 && subtle.faces < subtle.bots * 0.4,
    `0.3 faces ${subtle.faces}/${subtle.bots}`,
  );
  assert.ok(
    subtle.times > 0 && subtle.times < subtle.bots * 0.4,
    `0.3 times ${subtle.times}/${subtle.bots}`,
  );
  assert.ok(
    subtle.badges > 0 && subtle.badges < subtle.total * 0.45,
    `0.3 badges ${subtle.badges}/${subtle.total}`,
  );
  assert.ok(
    subtle.thinned < subtle.people * 0.15,
    `0.3 thinned ${subtle.thinned}/${subtle.people}`,
  );

  const loud = count(0.9);
  assert.equal(
    loud.faces,
    loud.bots,
    "every automated face is the same blank face",
  );
  assert.equal(loud.times, loud.bots, "every automated post shares one minute");
  assert.ok(
    loud.badges >= loud.total - loud.thinned,
    "badges on everything still standing",
  );
  assert.ok(
    loud.thinned > loud.people * 0.4,
    `0.9 thinned ${loud.thinned}/${loud.people}`,
  );
  assert.equal(loud.botThinned, 0, "bots are never the ones removed");

  const late = buildWireEntries([...items, ...humans], 0.9).filter(
    (e) => e.collapsedTime,
  );
  assert.equal(
    new Set(late.map((e) => parseClock(e.dateLabel))).size,
    1,
    "one flood minute",
  );
});

test("identical headlines from several outlets fold into one story", () => {
  const items = toWireItems(
    [],
    [
      {
        id: "o1",
        kind: "headline",
        outletId: "meridian",
        outletName: "The Meridian",
        topic: "grid",
        text: "Nationwide outage leaves 31 million dark",
        dateLabel: "DAY 3 · 08:00",
        day: 2,
        isBot: false,
        severity: 1,
      },
      {
        id: "o2",
        kind: "headline",
        outletId: "northwind",
        outletName: "Northwind Post",
        topic: "grid",
        text: "Nationwide outage leaves 31 million dark.",
        dateLabel: "DAY 3 · 08:20",
        day: 2,
        isBot: false,
        severity: 1,
      },
    ],
  );
  const entries = buildWireEntries(items, 0);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.item.source.name, "Northwind Post");
  assert.deepEqual(entries[0]!.alsoCarriedBy, ["The Meridian"]);
  assert.match(detailLine(entries[0]!, 2, 0), /also The Meridian/);
});

test("post stamps collapse to the flood minute; otherwise show age", () => {
  const items = toWireItems(
    [],
    [bot("s1", 3, "Stay calm."), post("s2", 9, "Where is everyone?")],
  );
  const [newest, older] = buildWireEntries(items, 0);
  assert.equal(postStamp(newest!, 9), "10:09");
  assert.equal(postStamp(older!, 9), "6d");
  const loud = buildWireEntries(items, 0.95).find((e) => e.item.isBot)!;
  assert.equal(loud.collapsedTime, true);
  assert.equal(postStamp(loud, 9), "10:03");
});

/* ------------------------------------------------------------ keyed updates */

interface FakeNode {
  key: string;
  renders: number;
}
function fakeHost() {
  const children: FakeNode[] = [];
  const ops: string[] = [];
  const host: KeyedHost<FakeNode> = {
    nodes: () => children,
    insertBefore(node, ref) {
      const at = children.indexOf(node);
      if (at >= 0) children.splice(at, 1);
      const i = ref ? children.indexOf(ref) : children.length;
      children.splice(i < 0 ? children.length : i, 0, node);
      ops.push(`insert:${node.key}`);
    },
    remove(node) {
      children.splice(children.indexOf(node), 1);
      ops.push(`remove:${node.key}`);
    },
  };
  return { host, children, ops };
}

function run(
  host: KeyedHost<FakeNode>,
  map: Map<string, FakeNode>,
  keys: string[],
) {
  return reconcileKeyed(
    host,
    keys,
    (k) => k,
    map,
    (k) => ({ key: k, renders: 1 }),
    (node) => {
      node.renders++;
    },
  );
}

test("keyed update keeps existing nodes and only inserts the new one", () => {
  const { host, children, ops } = fakeHost();
  const map = new Map<string, FakeNode>();
  const first = run(host, map, ["c", "b", "a"]);
  assert.deepEqual(first.added, ["c", "b", "a"]);
  const [c, b, a] = children;
  ops.length = 0;

  const second = run(host, map, ["d", "c", "b", "a"]);
  assert.deepEqual(second.added, ["d"]);
  assert.deepEqual(second.kept, ["c", "b", "a"]);
  assert.deepEqual(second.moved, []);
  assert.deepEqual(second.removed, []);
  assert.deepEqual(ops, ["insert:d"], "one DOM operation for one new item");
  assert.strictEqual(children[1], c);
  assert.strictEqual(children[2], b);
  assert.strictEqual(children[3], a);
  assert.equal(c!.renders, 2, "kept nodes are updated in place");
  assert.deepEqual(
    children.map((n) => n.key),
    ["d", "c", "b", "a"],
  );
});

test("keyed update: removals, a group bubbling up, duplicate keys", () => {
  const { host, children, ops } = fakeHost();
  const map = new Map<string, FakeNode>();
  run(host, map, ["e", "d", "c", "b", "a"]);
  const b = map.get("b")!;
  ops.length = 0;
  const res = run(host, map, ["b", "e", "d", "c", "c"]);
  assert.deepEqual(res.removed, ["a"]);
  assert.deepEqual(res.moved, ["b"], "only the bubbling node is re-inserted");
  assert.deepEqual(ops, ["remove:a", "insert:b"]);
  assert.strictEqual(children[0], b);
  assert.deepEqual(
    children.map((n) => n.key),
    ["b", "e", "d", "c"],
  );
});

test("feed-level: a duplicate bot post arriving preserves the pile's node", () => {
  const { host, children } = fakeHost();
  const map = new Map<string, FakeNode>();
  const v1 = toWireItems(
    [],
    [
      bot("x1", 1, "Nothing is wrong."),
      post("h1", 2, "Where did everyone go?"),
      bot("x2", 3, "Nothing is wrong."),
    ],
  );
  const e1 = buildWireEntries(v1, 0.6);
  reconcileKeyed(
    host,
    e1,
    (e) => e.key,
    map,
    (e) => ({ key: e.key, renders: 1 }),
    (n) => n.renders++,
  );
  const pile = map.get("x1")!;
  const human = map.get("h1")!;
  const v2 = toWireItems(
    [],
    [
      bot("x1", 1, "Nothing is wrong."),
      post("h1", 2, "Where did everyone go?"),
      bot("x2", 3, "Nothing is wrong."),
      bot("x3", 4, "Nothing is wrong!"),
    ],
  );
  const e2 = buildWireEntries(v2, 0.6);
  const res = reconcileKeyed(
    host,
    e2,
    (e) => e.key,
    map,
    (e) => ({ key: e.key, renders: 1 }),
    (n) => n.renders++,
  );
  assert.deepEqual(res.added, []);
  assert.strictEqual(map.get("x1"), pile);
  assert.strictEqual(map.get("h1"), human);
  assert.strictEqual(children[0], pile);
  assert.ok(e2[0]!.similar >= 2);
});

/* ------------------------------------------------------------ ticker */

test("ticker lines are trimmed, deduplicated and read as one string", () => {
  assert.deepEqual(
    normalizeTickerLines([
      "  VELA ▲ 18.4%  ",
      "Grid load 94%.",
      "vela ▲ 18.4%",
      "",
      null,
      undefined,
      "Ostra   curfew 21:00",
    ]),
    ["VELA ▲ 18.4%", "Grid load 94%", "Ostra curfew 21:00"],
  );
  assert.equal(
    tickerText(["One.", "Two", "two", " Three "]),
    "One · Two · Three",
  );
  assert.equal(tickerText([]), "");
});

test("ticker prefers ambient ticker items, newest first, and tops up with headlines", () => {
  const ambient: AmbientFeedItemLike[] = [
    {
      id: "t1",
      kind: "ticker",
      topic: "",
      text: "Old line",
      dateLabel: "",
      isBot: false,
      severity: 0,
    },
    {
      id: "t2",
      kind: "ticker",
      topic: "",
      text: "New line",
      dateLabel: "",
      isBot: false,
      severity: 0,
    },
  ];
  const items: WireItem[] = toWireItems(
    [
      news("h1", 1, "Relay", "Drone swarm grounds corridor; 14 dead."),
      news("h2", 0, "Ledger", "Markets open higher."),
    ],
    ambient,
  );
  const lines = wireTickerLines(ambient, items);
  assert.deepEqual(lines.slice(0, 2), ["New line", "Old line"]);
  assert.ok(lines.includes("Breaking: Drone swarm grounds corridor; 14 dead"));
  assert.ok(lines.includes("Markets open higher"));
  const many = Array.from({ length: 20 }, (_, i): AmbientFeedItemLike => ({
    id: `t${i}`,
    kind: "ticker",
    topic: "",
    text: `Line ${i}`,
    dateLabel: "",
    isBot: false,
    severity: 0,
  }));
  const capped = wireTickerLines(many, items);
  assert.equal(capped.length, 14);
  assert.equal(capped[0], "Line 19");
  assert.equal(
    wireFactoid([
      ...ambient,
      {
        id: "f1",
        kind: "factoid",
        topic: "",
        text: "  Grid load 94%. ",
        dateLabel: "",
        isBot: false,
        severity: 0,
      },
    ]),
    "Grid load 94%.",
  );
  assert.equal(wireFactoid(ambient), null);
});

test("toWireView assembles a complete view", () => {
  const view = toWireView([news("a", 4, "Relay", "Launch delayed.")], [], {
    stage: 3,
    botSaturation: 0.2,
    reducedMotion: true,
  });
  assert.equal(view.items.length, 1);
  assert.equal(view.today, 4);
  assert.equal(view.reducedMotion, true);
  assert.deepEqual(view.ticker, ["Launch delayed"]);
  assert.equal(view.factoid, null);
});
