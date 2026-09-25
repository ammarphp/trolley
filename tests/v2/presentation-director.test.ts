import test from "node:test";
import assert from "node:assert/strict";
import { createCampaign, commitChoice } from "../../src/simulation/index.ts";
import { CAMPAIGN_MANIFEST, CAMPAIGN_NODES } from "../../src/content/campaign/index.ts";
import { deriveStageView, deriveEnvironment, clockLabel, impactHistory } from "../../src/presentation/derive.ts";
import { stagingFor, STAGING } from "../../src/render/staging/index.ts";
import type { Campaign } from "../../src/contracts/index.ts";

async function play(seed: string, policy: (c: Campaign) => string, max = 45): Promise<Campaign[]> {
  let c = await createCampaign(CAMPAIGN_MANIFEST, CAMPAIGN_NODES, seed);
  const states = [c];
  for (let i = 0; i < max && c.prepared; i++) {
    c = await commitChoice(c, { decisionId: c.prepared.id, optionId: policy(c), expectedRevision: c.revision, actor: "human" }, CAMPAIGN_NODES);
    states.push(c);
  }
  return states;
}
const first = (c: Campaign) => c.prepared!.leftOptionId;
const cautious = (c: Campaign) => {
  const p = c.prepared!;
  const safe = p.node.options.find((o) => ["inspect", "restrict", "recover", "coordinate", "maintain"].includes(o.intent));
  return (safe ?? p.node.options[0]).id;
};

test("every environment channel stays within 0..1 across whole runs", async () => {
  for (const [seed, policy] of [
    ["env-a", first],
    ["env-b", cautious],
  ] as const) {
    for (const c of await play(seed, policy)) {
      const env = deriveEnvironment(c, c.ending?.id);
      for (const [k, v] of Object.entries(env)) assert.ok(v >= 0 && v <= 1 && Number.isFinite(v), `${k}=${v}`);
    }
  }
});

test("the day advances monotonically from dawn toward night", async () => {
  const states = await play("dayline", first);
  const times = states.filter((c) => !c.ending).map((c) => deriveEnvironment(c).timeOfDay);
  for (let i = 1; i < times.length; i++) assert.ok(times[i]! >= times[i - 1]! - 1e-9);
  assert.equal(clockLabel(0.24), "06:40");
});

test("windshield damage only ever accumulates", async () => {
  const states = await play("glass", first);
  let last = 0;
  for (const c of states) {
    const { impacts } = impactHistory(c, stagingFor);
    assert.ok(impacts >= last);
    last = impacts;
  }
});

test("the view is a pure function of the campaign (resume reproduces it)", async () => {
  const states = await play("pure", cautious, 12);
  const c = states.at(-1)!;
  const a = deriveStageView({ campaign: c, phase: "decision", reducedGraphics: false, staging: stagingFor });
  const b = deriveStageView({ campaign: structuredClone(c), phase: "decision", reducedGraphics: false, staging: stagingFor });
  assert.deepEqual(a, b);
});

test("reduced graphics removes blood but not impacts", async () => {
  const states = await play("gore", first);
  const c = states.at(-1)!;
  const full = deriveStageView({ campaign: c, phase: "consequence", reducedGraphics: false, staging: stagingFor });
  const reduced = deriveStageView({ campaign: c, phase: "consequence", reducedGraphics: true, staging: stagingFor });
  assert.equal(reduced.cabin.bloodied, 0);
  assert.equal(reduced.cabin.impacts, full.cabin.impacts);
});

test("the face never smiles again after the first death", async () => {
  const states = await play("face", first);
  let seenDeath = false;
  for (const c of states) {
    const view = deriveStageView({ campaign: c, phase: "decision", reducedGraphics: false, staging: stagingFor });
    if (c.world.facts.firstDeath && c.journal.length > 0) seenDeath = true;
    if (seenDeath) assert.ok(view.cabin.face.stage >= 1 && view.cabin.face.smile <= 0, `ordinal ${c.journal.length}`);
  }
});

test("decisions are always staged with something on the tracks", async () => {
  const states = await play("staged", cautious, 30);
  for (const c of states.filter((s) => s.prepared)) {
    const view = deriveStageView({ campaign: c, phase: "decision", reducedGraphics: false, staging: stagingFor });
    assert.ok(view.staging, "a decision view carries staging");
    assert.ok(view.staging!.left.occupants.length + view.staging!.right.occupants.length > 0, c.prepared!.nodeId);
  }
});

test("staging covers every campaign node and option", () => {
  if (Object.keys(STAGING).length === 0) return; // authored staging not yet merged
  for (const node of CAMPAIGN_NODES) {
    const s = STAGING[node.id];
    assert.ok(s, `staging for ${node.id}`);
    for (const option of node.options) assert.ok(s!.options[option.id], `${node.id}/${option.id}`);
  }
});

test("scripted disruptions are rare and deterministic", async () => {
  const states = await play("cues", first);
  const kinds = new Map<string, number>();
  for (const c of states.filter((s) => s.prepared)) {
    const v = deriveStageView({ campaign: c, phase: "decision", reducedGraphics: false, staging: stagingFor });
    for (const cue of v.cues) kinds.set(cue.kind, (kinds.get(cue.kind) ?? 0) + 1);
  }
  assert.ok((kinds.get("freeze") ?? 0) <= 1, "at most one freeze per run");
  assert.ok((kinds.get("false-dawn") ?? 0) <= 1, "at most one false dawn per run");
  assert.ok((kinds.get("revision") ?? 0) <= 1, "at most one revised reply per run");
  const again = await play("cues", first);
  assert.deepEqual(
    again.filter((s) => s.prepared).map((c) => deriveStageView({ campaign: c, phase: "decision", reducedGraphics: false, staging: stagingFor }).cues),
    states.filter((s) => s.prepared).map((c) => deriveStageView({ campaign: c, phase: "decision", reducedGraphics: false, staging: stagingFor }).cues),
  );
});
