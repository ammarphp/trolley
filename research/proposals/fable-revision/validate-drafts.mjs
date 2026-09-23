import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { SLICE_NODES } from '../../../src/content/archive/slice-510ec90a.ts';

const dir = new URL('./', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('packet-manifest.json', dir), 'utf8'));
const hash = (s) => crypto.createHash('sha256').update(s).digest('hex');
const rows = [];
const allIds = [];
for (const packet of manifest.packets) {
  const rawBytes = fs.readFileSync(new URL(packet.expectedOutput, dir));
  const raw = rawBytes.toString('utf8');
  const originalDraft = JSON.parse(raw.slice(raw.indexOf('{')));
  const file = `reviewed-${packet.id.slice(0, 2)}.json`;
  const reviewedBytes = fs.readFileSync(new URL(file, dir));
  const draft = JSON.parse(reviewedBytes);
  assert.equal(draft.kind, 'proposed_prose_replacements');
  assert.equal(draft.subset, packet.id);
  assert.deepEqual(draft.nodes.map((n) => n.nodeId), packet.nodeIds);
  assert.deepEqual(originalDraft.nodes.map((n) => n.nodeId), packet.nodeIds);
  const measurements = [];
  for (const node of draft.nodes) {
    allIds.push(node.nodeId);
    const base = SLICE_NODES.find((n) => n.id === node.nodeId);
    assert.ok(base, node.nodeId);
    assert.deepEqual(Object.keys(node).sort(), ['nodeId','title','prompt','options','advice','newsReplacements','optionalConditionalLines','editorialNotes'].sort());
    assert.ok(node.prompt.length <= 1600 && node.title.length <= 120, node.nodeId);
    assert.deepEqual(node.options.map((o) => o.optionId), base.options.map((o) => o.id));
    for (const option of node.options) {
      assert.deepEqual(Object.keys(option).sort(), ['optionId','label','consequence'].sort());
      assert.ok(option.label.trim().split(/\s+/u).length <= 12);
      assert.ok(option.label.length <= 100);
      assert.ok(option.consequence.length <= 1200);
    }
    assert.equal(node.advice.length, base.advice.length);
    node.advice.forEach((advice, index) => {
      assert.equal(advice.index, index);
      assert.deepEqual(Object.keys(advice).sort(), ['index','question','answer','reasoning'].sort());
      assert.ok(advice.answer.length <= 1600 && advice.reasoning.length <= 800);
      assert.ok(!/author-written|authored assessment|model.s private reasoning/i.test(advice.reasoning));
    });
    for (const replacement of node.newsReplacements) {
      assert.match(replacement.path, /^options\[\d+\]\.(?:effects\[\d+\]|delayed\[\d+\]\.effects\[\d+\]|incidents\[\d+\]\.(?:effects|otherwise)\[\d+\])\.headline$/u);
      const parts = replacement.path.replace(/\[(\d+)\]/gu, '.$1').split('.');
      let value = base;
      for (const part of parts) value = value?.[part];
      assert.equal(typeof value, 'string', `${node.nodeId}:${replacement.path}`);
      assert.ok(replacement.headline.length <= 240);
    }
    measurements.push({nodeId: node.nodeId, promptWords:node.prompt.trim().split(/\s+/u).length, promptCharacters:node.prompt.length, advice:node.advice.map((a)=>({index:a.index,words:a.answer.trim().split(/\s+/u).length,characters:a.answer.length,assessmentCharacters:a.reasoning.length}))});
  }
  rows.push({subset:packet.id, rawFile:packet.expectedOutput, rawSHA256:hash(rawBytes), rawBytes:rawBytes.length, rawPrefixRemoved:raw.indexOf('{')>0, reviewedFile:file, reviewedSHA256:hash(reviewedBytes), reviewedBytes:reviewedBytes.length, measurements});
}
assert.equal(allIds.length,14);
assert.equal(new Set(allIds).size,14);
assert.deepEqual([...allIds].sort(),SLICE_NODES.map(n=>n.id).sort());
const report={schemaVersion:1,checkedOn:'2026-09-23',status:'pass',nodeCount:14,checks:['all expected IDs, option IDs and advice slot counts','no executable fields in prose proposal','1600/1600/800 character prompt/answer/assessment limits','12-word and 100-character choice labels','1200-character consequences','existing news paths and 240-character news limit'],limits:['Not an engine replay or UI layout test.','Optional conditional lines remain nonexecutable proposals and require event-aware integration.','Named people are narrative staging; this does not implement identity/cohort accounting or full campaign callbacks.','The source premise audit predates these drafts; new fictional detail is not external evidence.'],packets:rows};
fs.writeFileSync(new URL('validation.json',dir),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,nodes:14,packets:rows.length,rawHashes:rows.map(r=>r.rawSHA256)}));
