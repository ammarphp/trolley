import { writeFile } from 'node:fs/promises';
const origin=process.env.COLLECTOR_URL;
if(!origin)throw new Error('COLLECTOR_URL is required.');
const url=new URL('/stats',origin);
if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Use HTTPS.');
const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
if(!response.ok)throw new Error(`Collector returned ${response.status}. Existing snapshot was preserved.`);
const raw=await response.json();
for(const k of ['totalRuns','totalDecisions','totalResponses'])if(!Number.isSafeInteger(raw[k])||raw[k]<0)throw new Error('Invalid aggregate count.');
if(raw.schemaVersion!==1||raw.unit!=='run')throw new Error('Unsupported aggregate schema.');
const families=new Set(['classic','numbers','uncertainty','relationships','responsibility','time','personhood','consent','systems','incentives','absurd','meta']);
const count=n=>Number.isSafeInteger(n)&&n>=0;
const groups=(raw.groups||[]).map(g=>{
  if(!families.has(g.family)||!['descent','explore'].includes(g.mode)||!count(g.total)||!count(g.pulled)||g.pulled>g.total||!count(g.runs)||g.runs<10)throw new Error('Unsafe aggregate group.');
  return {family:g.family,mode:g.mode,total:g.total,pulled:g.pulled,runs:g.runs};
});
const lengths=(raw.lengths||[]).map(g=>{if(!['0','1–3','4–8','9–14','15–21','22–38','39+'].includes(g.label)||!count(g.runs)||g.runs<10)throw new Error('Unsafe length bucket.');return {label:g.label,runs:g.runs};});
const stages=(raw.stages||[]).map(g=>{if(!Number.isInteger(g.stage)||g.stage<0||g.stage>6||!count(g.runs)||g.runs<10||!count(g.decisions)||!count(g.pulled)||g.pulled>g.decisions)throw new Error('Unsafe stage bucket.');return {stage:g.stage,runs:g.runs,decisions:g.decisions,pulled:g.pulled};});
// Never spread the remote object: raw fields cannot enter a public aggregate artifact.
const safe={schemaVersion:1,generatedAt:new Date().toISOString(),totalRuns:raw.totalRuns,totalDecisions:raw.totalDecisions,totalResponses:raw.totalResponses,groups,lengths,stages,withheld:!!raw.withheld,unit:'run',note:'Runs are playthroughs, not unique people. Private runs are not counted. Small groups are suppressed.'};
await writeFile('dist/aggregate.json',JSON.stringify(safe,null,2)+'\n');
console.log(`Saved aggregate snapshot: ${safe.totalRuns} runs, ${safe.totalDecisions} decisions. No raw records.`);
