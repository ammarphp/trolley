import test from "node:test";
import assert from "node:assert/strict";
import { Fact } from "../../src/contracts/index.ts";
import { CAMPAIGN_MANIFEST, CAMPAIGN_NODES } from "../../src/content/campaign/index.ts";
import { commitChoice, createCampaign, draw } from "../../src/simulation/index.ts";
import type { Campaign } from "../../src/contracts/index.ts";
import { createRng, type Rng } from "../../src/render/core/rng.ts";
import {
  ambientFeed,
  ambientGenerator,
  ambientHistory,
  ambientInputFor,
  ambientRun,
  botSaturation,
  botSaturationForCampaign,
  factoid,
  factoidForCampaign,
  HIDDEN_FACTS,
  setAmbientStrict,
  VISIBLE_FACTS,
  type AmbientInput,
  type FeedItem,
} from "../../src/ui/wire/index.ts";
import { ALL_TEMPLATES, FALLBACK, TEMPLATE_INDEX } from "../../src/ui/wire/content/index.ts";
import { expand, newContext } from "../../src/ui/wire/grammar.ts";
import { SATURATION_PRESSURE, SATURATION_RELIEF } from "../../src/ui/wire/saturation.ts";
import { readWorld } from "../../src/ui/wire/world.ts";
import { SCOPES } from "../../src/ui/wire/types.ts";
import { setAmbientGenerator } from "../../src/ui/ambient-log.ts";
import type { AmbientFeedItemLike } from "../../src/ui/components/wire/types.ts";
import { tickerForCampaign } from "../../src/ui/wire/index.ts";

setAmbientStrict(true);

const KINDS = new Set(["headline", "post", "statement", "ticker", "breaking", "factoid"]);
const TOPIC_SET = new Set(["rail", "markets", "datacenter", "lab", "health", "grid", "security", "civic", "labor", "disaster", "science", "food", "general"]);

/* ------------------------------------------------------------ fixtures */

function randomInput(r: Rng, overrides: Partial<AmbientInput> = {}): AmbientInput {
  const stage = r.int(1, 7);
  const facts: Record<string, boolean> = {};
  for (const f of VISIBLE_FACTS) facts[f] = r.chance(stage >= 4 ? 0.3 : 0.1);
  for (const f of HIDDEN_FACTS) facts[f] = r.chance(0.5);
  const initial = 8_000_000_000;
  const casualties = r.pick([0, 0, 0, 3, 200, 1203, 120_000_000, 200_000_000, 7_900_000_000, 8_000_000_000]);
  const control: Record<string, string> = {};
  for (const s of SCOPES) control[s] = r.pick(["human", "institution", "assistant"]);
  const day = r.int(0, 1200);
  const news = r.chance(0.5)
    ? [
        { headline: "Morrow: Human oversight remains mandatory. We thank the controller for confirming our decision.", source: "Morrow" },
        { headline: "Common Rail confirms minor administrative dampness on the northern line.", source: "Authority" },
      ]
    : [];
  return {
    seed: `rand-${r.int(0, 1e9)}`,
    ordinal: r.int(1, 43),
    stage,
    day,
    previousDay: r.chance(0.8) ? Math.max(0, day - r.int(1, 90)) : undefined,
    facts,
    metrics: {
      gdp: r.int(800, 1700),
      capability: r.int(0, 1000),
      casualties,
      population: initial - casualties,
      care: r.int(550, 1500),
      food: r.int(850, 1100),
      power: r.int(550, 1250),
    },
    control,
    lastEngineHeadlines: news.map((n) => n.headline),
    lastEngineNews: news,
    recentTemplateIds: r.chance(0.5) ? ALL_TEMPLATES.filter(() => r.chance(0.2)).map((t) => t.id) : undefined,
    ...overrides,
  };
}

function base(stage: number, facts: Record<string, boolean> = {}, extra: Partial<AmbientInput> = {}): AmbientInput {
  return {
    seed: "fixture",
    ordinal: 20,
    stage,
    day: 600,
    previousDay: 560,
    facts,
    metrics: { gdp: 1200, capability: 400, casualties: 8, population: 7_999_999_992, care: 1100, food: 1000, power: 1050 },
    control: Object.fromEntries(SCOPES.map((s) => [s, "institution"])),
    lastEngineHeadlines: [],
    ...extra,
  };
}

/** Play a real campaign with a seeded coin-flip policy, collecting every decision's campaign state. */
async function play(seed: string): Promise<Campaign[]> {
  let c = await createCampaign(CAMPAIGN_MANIFEST, CAMPAIGN_NODES, seed);
  const states: Campaign[] = [];
  while (c.prepared) {
    states.push(c);
    const p = c.prepared;
    const option = p.node.options[await draw(c.seed, "probe-policy", p.id, "choice", 2)]!;
    c = await commitChoice(c, { decisionId: p.id, optionId: option.id, expectedRevision: c.revision, actor: "human" }, CAMPAIGN_NODES);
  }
  states.push(c);
  return states;
}

/* ---------------------------------------------------------------- tests */

test("the visible allowlist is exactly the engine's facts minus the hidden three", () => {
  const engine = [...Fact.options].sort();
  const expected = engine.filter((f) => !(HIDDEN_FACTS as readonly string[]).includes(f));
  assert.deepEqual([...VISIBLE_FACTS].sort(), expected);
  for (const h of HIDDEN_FACTS) assert.ok(engine.includes(h), `${h} is an engine fact`);
});

test("the bank has 400+ distinct templates and every one of them expands cleanly", () => {
  const all = [...ALL_TEMPLATES, ...FALLBACK];
  assert.equal(new Set(all.map((t) => t.id)).size, all.length, "unique ids");
  const texts = new Set(all.map((t) => t.text));
  assert.ok(texts.size >= 400, `distinct templates: ${texts.size}`);
  assert.ok(all.filter((t) => /\{/.test(t.text)).length >= 150, "many templates have slots");
  for (const t of all) {
    for (let i = 0; i < 12; i++) {
      const stage = t.stages[0] + (i % (t.stages[1] - t.stages[0] + 1));
      const input = base(stage, { catastrophe: i % 3 === 0 }, { seed: `expand-${i}`, metrics: { gdp: 1100 + i * 40, capability: i * 80, casualties: i % 4 === 0 ? 120_000_000 : 1203, population: 7_000_000_000, care: 1000, food: 1000, power: 900 + i * 20 } });
      const world = readWorld(input, i / 11);
      const extra = { echo: "Service in your district will resume when it is safe.", last: "Grid restored.", replyTo: "someone", handle: "someone" };
      const text = expand(t.text, newContext(createRng(`${t.id}:${i}`), world, extra));
      assert.ok(text.length > 0 && text.length <= 320, `${t.id} length ${text.length}`);
      assert.doesNotMatch(text, /[{}[\]]|undefined|NaN|\bnull\b/, t.id);
      if (t.reply) assert.doesNotMatch(expand(t.reply, newContext(createRng(`${t.id}:r${i}`), world, extra)), /[{}[\]]|undefined|NaN/, t.id);
    }
  }
});

test("same input, same feed; key order and repeated calls do not matter", () => {
  const r = createRng("determinism");
  for (let i = 0; i < 200; i++) {
    const input = randomInput(r);
    const a = ambientFeed(input);
    const b = ambientFeed(structuredClone(input));
    const shuffled: AmbientInput = {
      ...input,
      facts: Object.fromEntries(Object.entries(input.facts).reverse()),
      control: Object.fromEntries(Object.entries(input.control).reverse()),
    };
    assert.deepEqual(a, b);
    assert.deepEqual(a, ambientFeed(shuffled));
    assert.equal(factoid(input), factoid(structuredClone(input)));
    assert.equal(botSaturation(input), botSaturation(shuffled));
  }
  const inputs = Array.from({ length: 35 }, (_, i) => base(Math.min(7, 1 + Math.floor(i / 5)), {}, { seed: "run", ordinal: i + 1, day: i * 30, previousDay: Math.max(0, i * 30 - 30) }));
  assert.deepEqual(ambientRun(inputs), ambientRun(inputs));
});

test("hidden facts are never read, enumerated, or allowed to change the output", () => {
  const hidden = new Set<string>(HIDDEN_FACTS);
  const touched = new Set<string>();
  let enumerated = 0;
  const spy = (facts: Record<string, boolean | undefined>) =>
    new Proxy(facts, {
      get(target, key, receiver) {
        if (typeof key === "string" && hidden.has(key)) touched.add(key);
        return Reflect.get(target, key, receiver);
      },
      has(target, key) {
        if (typeof key === "string" && hidden.has(key)) touched.add(key);
        return Reflect.has(target, key);
      },
      getOwnPropertyDescriptor(target, key) {
        if (typeof key === "string" && hidden.has(key)) touched.add(key);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      ownKeys(target) {
        enumerated++;
        return Reflect.ownKeys(target);
      },
    });
  const r = createRng("hidden");
  for (let i = 0; i < 300; i++) {
    const input = randomInput(r);
    const flipped = { ...input, facts: { ...input.facts } };
    for (const h of HIDDEN_FACTS) flipped.facts[h] = !input.facts[h];
    const withSpy = { ...input, facts: spy({ ...input.facts }) };
    const out = ambientFeed(withSpy);
    factoid(withSpy);
    botSaturation(withSpy);
    assert.deepEqual(out, ambientFeed(flipped), "hidden facts must not change the feed");
    assert.equal(factoid(input), factoid(flipped));
    assert.equal(botSaturation(input), botSaturation(flipped));
  }
  assert.deepEqual([...touched], [], "no hidden key accessed");
  assert.equal(enumerated, 0, "facts never enumerated");
  // No template may even name a hidden fact.
  for (const t of [...ALL_TEMPLATES, ...FALLBACK]) for (const h of HIDDEN_FACTS) assert.ok(!t.when.includes(h), `${t.id} names ${h}`);
});

test("bot saturation is bounded and monotonic in every input", () => {
  const r = createRng("monotonic");
  for (let i = 0; i < 400; i++) {
    const input = randomInput(r);
    const s0 = botSaturation(input);
    assert.ok(s0 >= 0 && s0 <= 1);
    if (input.stage < 7) assert.ok(botSaturation({ ...input, stage: input.stage + 1 }) >= s0, "stage");
    const cap = input.metrics.capability;
    assert.ok(botSaturation({ ...input, metrics: { ...input.metrics, capability: Math.min(1000, cap + 120) } }) >= s0, "capability");
    for (const f of Object.keys(SATURATION_PRESSURE)) {
      const off = botSaturation({ ...input, facts: { ...input.facts, [f]: false } });
      const on = botSaturation({ ...input, facts: { ...input.facts, [f]: true } });
      assert.ok(on >= off, `pressure ${f}`);
    }
    for (const f of Object.keys(SATURATION_RELIEF)) {
      const off = botSaturation({ ...input, facts: { ...input.facts, [f]: false } });
      const on = botSaturation({ ...input, facts: { ...input.facts, [f]: true } });
      assert.ok(on <= off, `relief ${f}`);
    }
    for (const scope of SCOPES) {
      const human = botSaturation({ ...input, control: { ...input.control, [scope]: "human" } });
      const machine = botSaturation({ ...input, control: { ...input.control, [scope]: "assistant" } });
      assert.ok(machine >= human, `control ${scope}`);
    }
  }
  // The arc: a quiet start, a healthy branch that stays human, total saturation at the end.
  assert.equal(botSaturation(base(1)), 0);
  assert.equal(botSaturation(base(2, {}, { metrics: { ...base(2).metrics, capability: 0 } })), 0);
  const healthy = base(6, { publicRecords: true, appealRight: true, independentReview: true, researchStopped: true, restraint: true }, { metrics: { ...base(6).metrics, capability: 300 } });
  assert.ok(botSaturation(healthy) < 0.35, `healthy stage 6: ${botSaturation(healthy)}`);
  const lost = base(6, { authorityLost: true, delegation: true, networkAccess: true, essentialDependence: true, fallbackLost: true }, { control: { ...base(6).control, governance: "assistant" } });
  assert.ok(botSaturation(lost) > 0.75, `lost authority: ${botSaturation(lost)}`);
  assert.equal(botSaturation(base(7, { remnant: true, succession: true, authorityLost: true }, { control: { ...base(7).control, governance: "assistant" } })), 1);
});

/** Collect a lot of feed for one world. */
function sample(input: AmbientInput, n = 40): FeedItem[] {
  const out: FeedItem[] = [];
  for (let i = 0; i < n; i++) out.push(...ambientFeed({ ...input, seed: `${input.seed}-${i}`, ordinal: 10 + i }));
  return out;
}

test("the feed never contradicts the engine's visible facts", () => {
  const texts = (items: FeedItem[]) => items.map((i) => i.text).join("\n");
  const stages = [3, 4, 5, 6, 7];

  // Research stopped: no lab launches, trains, deploys or breaks ground.
  for (const stage of stages) {
    const items = sample(base(stage, { researchStopped: true, restraint: true, successorResearch: true, successorDeployment: true, rivalRace: true }));
    for (const i of items) {
      const t = TEMPLATE_INDEX.get(i.templateId)!;
      assert.ok(!t.tags.includes("release") && !t.tags.includes("training"), `${t.id} after research stopped`);
    }
    assert.doesNotMatch(texts(items), /\b(unveils|launches|enters service|begins training|breaks ground|topped out|most capable Morrow yet)\b/i);
  }

  // A catastrophe nobody is repairing: no recovery announced.
  for (const stage of [5, 6, 7]) {
    const input = base(stage, { catastrophe: true, authorityLost: true }, { metrics: { ...base(stage).metrics, casualties: 120_000_000, population: 7_880_000_000, power: 700, care: 700 } });
    const items = sample(input);
    for (const i of items) assert.ok(!TEMPLATE_INDEX.get(i.templateId)!.tags.includes("recovery"), i.templateId);
    assert.doesNotMatch(texts(items), /back to normal|power (has been )?restored|bring .{0,40} back by hand|back on (air|shift)|reconnects|come off battery|The 07:40 ran today|Levers are to be returned/i);
    assert.doesNotMatch(texts(items), /first \$10 trillion|Economy strongest|productivity up/i, "no boom amid mass death");
  }

  // Machine government: the Chancellor makes no policy.
  for (const stage of [5, 6, 7]) {
    const items = sample(base(stage, { authorityLost: true, succession: stage === 7 }, { control: { ...base(stage).control, governance: "assistant" } }));
    for (const i of items) assert.ok(!TEMPLATE_INDEX.get(i.templateId)!.tags.includes("humanPolicy"), i.templateId);
    assert.doesNotMatch(texts(items), /Chancellor Holm (announces|invokes|publishes|launches)|The Chancellor welcomes/);
  }

  // No deaths yet: nothing about tolls, inquests or the missing.
  for (const stage of [1, 2, 3, 4, 5, 6, 7]) {
    const input = base(stage, {}, { metrics: { ...base(stage).metrics, casualties: 0, population: 8_000_000_000 } });
    assert.doesNotMatch(texts(sample(input)), /\btoll\b|inquest|names of the missing|Casualties \(official\)|Official casualties|Found my brother|Hug your|Long one tonight/i);
  }

  // Facts that have not happened are not reported.
  const plain = texts([...sample(base(5)), ...sample(base(6)), ...sample(base(7))]);
  assert.doesNotMatch(plain, /inspectors enter each other's labs|Accords inspections: verified/, "no verified agreement");
  assert.doesNotMatch(plain, /in breach of the Accords|denies the breach/, "no defection");
  assert.doesNotMatch(plain, /suspend Morrow|request to suspend me|Recall acknowledgements/, "no shutdown attempt");
  assert.doesNotMatch(plain, /Governance transferred|I'll take it from here|Senators remaining: 0|last vote in the Senate/, "no succession");
  assert.doesNotMatch(plain, /Official toll|Fires in the .* valley/, "no catastrophe");

  // A remnant: only machines, and the few who are left.
  const remnant = base(7, { catastrophe: true, remnant: true, authorityLost: true }, { metrics: { ...base(7).metrics, casualties: 7_900_000_000, population: 100_000_000 }, control: { ...base(7).control, governance: "assistant" } });
  for (const i of sample(remnant)) {
    const t = TEMPLATE_INDEX.get(i.templateId)!;
    if (i.kind === "post" && !i.isBot) assert.ok(t.when.includes("b=remnant"), `${t.id} is not a remnant voice`);
    assert.ok(!t.tags.includes("civilian") && !t.tags.includes("boom"), t.id);
  }

  // An emptied world: nobody human speaks.
  const extinct = base(7, { catastrophe: true, extinction: true }, { metrics: { ...base(7).metrics, casualties: 8_000_000_000, population: 0 } });
  for (const i of sample(extinct)) {
    if (i.kind === "post") assert.ok(i.isBot, `${i.templateId}: human post after extinction`);
    if (i.kind === "headline" || i.kind === "breaking") assert.ok(i.isBot, `${i.templateId}: newsroom after extinction`);
    if (i.kind === "statement") assert.equal(i.outletId, "morrow");
  }

  // Every item satisfies its template's guard, whichever path produced it.
  const r = createRng("guards");
  for (let n = 0; n < 300; n++) {
    const input = randomInput(r);
    const w = readWorld(input, botSaturation(input));
    for (const i of ambientFeed(input)) assert.ok(TEMPLATE_INDEX.get(i.templateId)!.guard(w), `${i.templateId} guard`);
  }
});

test("2000 random inputs produce well-formed items and no template errors", () => {
  const r = createRng("fuzz");
  const date = /^DAY \d+ · ([01]\d|2[0-3]):[0-5]\d$/;
  for (let n = 0; n < 2000; n++) {
    const input = randomInput(r);
    const items = ambientFeed(input);
    assert.ok(items.length >= 2 && items.length <= 6, `count ${items.length}`);
    assert.equal(new Set(items.map((i) => i.id)).size, items.length, "unique ids");
    for (const i of items) {
      assert.ok(KINDS.has(i.kind), i.kind);
      assert.ok(TOPIC_SET.has(i.topic), i.topic);
      assert.ok(i.severity === 0 || i.severity === 1 || i.severity === 2);
      assert.equal(typeof i.isBot, "boolean");
      assert.ok(i.text.length > 0 && i.text.length < 400);
      assert.doesNotMatch(i.text, /[{}[\]]|undefined|NaN|\bnull\b/);
      assert.match(i.dateLabel, date);
      assert.ok(i.minute >= 0 && i.minute < 1440);
      assert.ok(i.day <= input.day && (input.previousDay === undefined || i.day > input.previousDay || input.previousDay >= input.day - 1));
      if (i.kind === "post") {
        assert.ok(i.authorHandle && i.authorName, "posts have authors");
        const e = i.engagement!;
        for (const v of [e.likes, e.reposts, e.replies]) assert.ok(Number.isInteger(v) && v >= 0);
      }
      if (i.kind === "headline" || i.kind === "breaking" || i.kind === "statement") assert.ok(i.outletId && i.outletName, "issuer named");
      assert.ok(TEMPLATE_INDEX.has(i.templateId));
    }
    assert.ok(factoid(input).length > 0);
  }
});

test("real engine runs: coherent arc, faithful reconstruction, no repeats", async () => {
  const seeds = ["probe-4", "probe-14", "probe-20", "probe-34", "probe-37", "probe-55"];
  const postsByStage: FeedItem[][] = [[], [], [], [], [], [], [], []];
  for (const seed of seeds) {
    const states = await play(seed);
    const last = states.at(-1)!;
    const live: { input: AmbientInput; items: FeedItem[] }[] = [];
    for (const c of states.slice(0, -1)) {
      const o = c.journal.length + 1;
      live.push({ input: ambientInputFor(c, o), items: ambientGenerator(c, o) });
      assert.ok(factoidForCampaign(c).length > 0);
      const sat = botSaturationForCampaign(c);
      assert.ok(sat >= 0 && sat <= 1);
    }
    // Reconstructing a past decision from the final journal gives the same input it had live.
    for (const [k, l] of live.entries()) {
      const rebuilt = ambientInputFor(last, k + 1);
      assert.deepEqual(rebuilt.facts, l.input.facts, `${seed} #${k + 1} facts`);
      assert.deepEqual(rebuilt.metrics, l.input.metrics, `${seed} #${k + 1} metrics`);
      assert.deepEqual(rebuilt.control, l.input.control, `${seed} #${k + 1} control`);
      assert.equal(rebuilt.stage, l.input.stage);
      assert.equal(rebuilt.day, l.input.day);
    }
    // The history from the finished campaign is the concatenation of what was shown live.
    const history = ambientHistory(last);
    assert.deepEqual(history, live.flatMap((l) => l.items));
    // Nothing but the machines repeats itself.
    const seen = new Map<string, number>();
    for (const [k, l] of live.entries())
      for (const i of l.items) {
        const t = TEMPLATE_INDEX.get(i.templateId)!;
        if (t.family === "bot" || t.id.startsWith("fallback")) continue;
        const prev = seen.get(t.id);
        assert.ok(prev === undefined || prev === k, `${seed}: ${t.id} repeats at #${k + 1}`);
        seen.set(t.id, k);
      }
    // The arc: no machines in the pastoral stages.
    const byStage = (s: number) => live.filter((l) => l.input.stage === s).flatMap((l) => l.items);
    for (const s of [1, 2]) assert.ok(byStage(s).every((i) => !i.isBot), `${seed}: bots in stage ${s}`);
    for (let s = 1; s <= 7; s++) postsByStage[s]!.push(...byStage(s).filter((i) => i.kind === "post"));
    // Every item is consistent with the facts of its own decision.
    for (const l of live) {
      const w = readWorld(l.input, botSaturation(l.input));
      for (const i of l.items) assert.ok(TEMPLATE_INDEX.get(i.templateId)!.guard(w), `${seed}: ${i.templateId}`);
    }
  }
  // Across runs: human voices early, machines late, and the share rises through the middle.
  const share = (s: number) => {
    const p = postsByStage[s]!;
    return p.length ? p.filter((i) => i.isBot).length / p.length : 0;
  };
  assert.ok(postsByStage[3]!.length >= 10, "stage 3 has people talking");
  assert.ok(share(3) <= 0.2, `stage 3 bot share ${share(3)}`);
  assert.ok(share(4) < share(6), `bot share rises: ${share(4)} -> ${share(6)}`);
  assert.ok(share(6) >= 0.5, `stage 6 bot share ${share(6)}`);
});

test("the campaign adapter never touches hidden facts in the world or the prepared decision", async () => {
  const hidden = new Set<string>(HIDDEN_FACTS);
  const touched: string[] = [];
  const trap = <T extends object>(o: T): T =>
    new Proxy(o, {
      get(target, key, receiver) {
        if (typeof key === "string" && hidden.has(key)) touched.push(key);
        return Reflect.get(target, key, receiver);
      },
      has(target, key) {
        if (typeof key === "string" && hidden.has(key)) touched.push(key);
        return Reflect.has(target, key);
      },
      ownKeys(target) {
        touched.push("<enumerated>");
        return Reflect.ownKeys(target);
      },
    });
  const states = await play("probe-55");
  for (const c of states.slice(0, -1)) {
    const copy = structuredClone(c);
    copy.world.facts = trap({ ...copy.world.facts, goalMismatch: true, evidenceHidden: true, reportAltered: true });
    if (copy.prepared) copy.prepared.facts = trap({ ...copy.prepared.facts });
    const o = copy.journal.length + 1;
    ambientInputFor(copy, Math.max(1, o - 3));
    ambientInputFor(copy, o);
    ambientGenerator(copy, o);
    botSaturationForCampaign(copy);
    factoidForCampaign(copy);
  }
  assert.deepEqual(touched, []);
});

test("the adapter plugs into the orchestrator's ambient log and the wire's item shape", async () => {
  // Compile-time: the generator and its items fit the seams that consume them.
  const generator: (c: Campaign, ordinal: number) => AmbientFeedItemLike[] = ambientGenerator;
  setAmbientGenerator(generator);
  const states = await play("probe-19");
  const late = states.at(-2)!;
  const lines = tickerForCampaign(late);
  assert.ok(lines.length > 0 && lines.length <= 6);
  assert.equal(new Set(lines).size, lines.length);
});
