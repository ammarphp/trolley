import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_TEMPLATES, generateScenario, fromUrl, scenarioUrl, eligibleTemplates } from '../src/engine.js';
import { generateDescent, chapterAt } from '../src/descent.js';
import { createRun, branchState } from '../src/runs.js';
import { csv, summarize } from '../src/storage.js';
import { publicPayload } from '../src/collector-client.js';
import { playCopy } from '../src/play-copy.js';

test('all templates produce complete, reproducible stimuli over diverse seeds', () => {
  assert.equal(new Set(ALL_TEMPLATES.map(t=>t.id)).size,ALL_TEMPLATES.length);
  assert.ok(ALL_TEMPLATES.length>=120);
  for(const t of ALL_TEMPLATES)for(let i=0;i<24;i++){
    const a=generateScenario(`test-${i}`,{templateId:t.id}), b=generateScenario(`test-${i}`,{templateId:t.id});
    assert.deepEqual(a,b);
    for(const key of ['setup','title','main','side','mainLabel','sideLabel','lens']){
      assert.ok(a[key].length>0,`${t.id}:${key}`);assert.doesNotMatch(a[key],/undefined|\{\w+\}/,`${t.id}:${key}`);
    }
    assert.ok(Number.isSafeInteger(a.mainCount)&&a.mainCount>0,t.id);
    assert.ok(a.sideCount===null||(Number.isSafeInteger(a.sideCount)&&a.sideCount>0),t.id);
    const copy=playCopy(a);assert.ok(copy.prompt.length>0);
    assert.deepEqual(fromUrl(scenarioUrl(a,'https://ammarphp.github.io/trolley/')),a);
  }
});
test('no empty eligible pool is silently replaced by another theme',()=>{
  assert.throws(()=>generateScenario('a',{family:'missing'}));
  assert.throws(()=>generateScenario('<script>',{}));
  assert.throws(()=>generateScenario('x',{templateId:'nope'}));
  assert.throws(()=>fromUrl('https://example.com/?v=old&case=classic-switch&seed=a'));
  assert.ok(eligibleTemplates({family:'classic',tone:'straight'}).every(t=>t.family==='classic'&&t.weirdness===0));
});
test('journey starts harmlessly, rebukes at stop 15, and continues beyond the last chapter',()=>{
  const seen=[];let branch={route:'unassigned',key:'start'};
  for(let i=0;i<160;i++){
    const s=generateDescent('run-seed',i,seen,branch);seen.push(s.id);
    assert.equal(s.depth,i);assert.equal(s.stage,chapterAt(i).stage);
    if(i===0)assert.equal(s.id,'orientation-coffee');if(i===14)assert.equal(s.id,'race-rebuke');if(i>38)assert.equal(s.stage,6);
    branch={route:'optimization',key:'pppspsppspp'};
  }
});
test('different choice histories change later routes; seed replay remains exact',()=>{
  const a=generateDescent('same-run',25,[],{route:'optimization',key:'pppppp'});
  const b=generateDescent('same-run',25,[],{route:'preservation',key:'ssssss'});
  assert.notEqual(a.seed,b.seed);assert.notEqual(a.scenarioId,b.scenarioId);
  assert.equal(generateScenario(a.seed,{templateId:a.id}).setup,a.setup);
});
test('new runs have no shared identity and payloads contain no browser/user identifiers',()=>{
  const a=createRun(),b=createRun();assert.notEqual(a.id,b.id);assert.notEqual(a.token,b.token);assert.notEqual(a.seed,b.seed);
  const payload=publicPayload({responseId:'x',choice:'pull',ordinal:0},a);
  for(const key of ['participantId','userId','visitorId','ip','userAgent','createdAt'])assert.ok(!(key in payload));
  assert.equal(payload.runId,a.id);assert.equal(payload.ordinal,0);
});
test('summaries exclude skips and CSV neutralizes formula cells',()=>{
  assert.deepEqual(summarize([{choice:'pull',family:'classic'},{choice:'stay',family:'classic'},{choice:'skip',family:'meta'}]),{total:2,pulled:1,stayed:1,skipped:1,families:1});
  const output=csv([{title:'=HYPERLINK("evil")'}]);assert.ok(output.includes("'=HYPERLINK"));
  assert.equal(branchState([{choice:'pull'},{choice:'pull'},{choice:'pull'}]).route,'optimization');
});
