import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from '../collector/worker.js';
import { sqliteAdapter } from '../collector/sqlite-adapter.js';
import { ENGINE_VERSION, CONSENT_VERSION } from '../src/engine.js';
const setup=()=>({DB:sqliteAdapter(new DatabaseSync(':memory:')),ALLOWED_ORIGINS:'https://ammarphp.github.io'});
const creds=()=>({runId:crypto.randomUUID(),runToken:crypto.randomUUID()+crypto.randomUUID(),engineVersion:ENGINE_VERSION,noticeVersion:CONSENT_VERSION,mode:'descent'});
async function call(env,path,body,{origin='https://ammarphp.github.io',method=body?'POST':'GET'}={}){
  const res=await worker.fetch(new Request('https://collector.test'+path,{method,headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
  return {status:res.status,data:res.status===204?null:await res.json(),headers:res.headers};
}
function answer(c,ordinal=0){return{...c,responseId:crypto.randomUUID(),ordinal,templateId:'classic-switch',seed:'test',choice:'pull',confidence:null,reason:null,activeMs:1800,elapsedMs:2000,position:1,source:'descent',depth:ordinal,stage:0,familyFilter:'all',toneFilter:'all'};}
test('independent run registration, append, idempotent retry, updated reflection, aggregate, withdrawal',async()=>{
  const env=setup(),c=creds();const registered=await call(env,'/runs',c);assert.equal(registered.status,201);assert.equal(registered.data.runNumber,1);
  assert.equal((await call(env,'/runs',c)).data.runNumber,1);
  const a=answer(c);assert.equal((await call(env,'/responses',a)).status,200);assert.equal((await call(env,'/responses',a)).status,200);
  assert.equal((await call(env,'/responses',{...a,reason:'harm'})).status,200);
  const stats=(await call(env,'/stats')).data;assert.equal(stats.totalRuns,1);assert.equal(stats.totalDecisions,1);assert.deepEqual(stats.groups,[]);
  const payload=JSON.parse((await env.DB.prepare('SELECT payload FROM responses').first()).payload);assert.equal(payload.reason,'harm');assert.ok(!('runToken'in payload));
  assert.equal((await call(env,'/withdraw',c)).status,200);assert.equal((await call(env,'/stats')).data.totalRuns,0);
  assert.equal((await call(env,'/responses',a)).status,410);assert.equal((await call(env,'/runs',c)).status,410);
});
test('new run means a new entry, without grouping by a user',async()=>{
  const env=setup();for(let i=0;i<10;i++){const c=creds();await call(env,'/runs',c);await call(env,'/responses',answer(c));}
  const stats=(await call(env,'/stats')).data;assert.equal(stats.totalRuns,10);assert.equal(stats.groups[0].runs,10);assert.equal(stats.groups[0].pulled,10);
});
test('malformed/forged data, wrong run keys, invalid origin and oversized bodies are rejected',async()=>{
  const env=setup(),c=creds();await call(env,'/runs',c);
  assert.equal((await call(env,'/responses',{...answer(c),runToken:creds().runToken})).status,403);
  assert.equal((await call(env,'/responses',{...answer(c),templateId:'fake'})).status,400);
  assert.equal((await call(env,'/responses',{...answer(c),activeMs:10000})).status,400);
  assert.equal((await call(env,'/responses',{...answer(c),source:'agent'})).status,400);
  assert.equal((await call(env,'/runs',creds(),{origin:'https://evil.example'})).status,403);
  assert.equal((await call(env,'/responses',{...answer(c),padding:'x'.repeat(13000)})).status,413);
  const preflight=await call(env,'/responses',undefined,{method:'OPTIONS'});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://ammarphp.github.io');
});
test('cross-run collisions cannot overwrite a response or change its original choice',async()=>{
  const env=setup(),c=creds(),d=creds();await call(env,'/runs',c);await call(env,'/runs',d);
  const a=answer(c);await call(env,'/responses',a);
  assert.equal((await call(env,'/responses',{...a,...d})).status,409);
  assert.equal((await call(env,'/responses',{...a,choice:'stay'})).status,409);
  assert.equal((await call(env,'/responses',answer(c))).status,409);
});
