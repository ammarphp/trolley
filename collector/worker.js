import { generateScenario, ENGINE_VERSION, CONSENT_VERSION, REASONS } from '../src/engine.js';
import { SCHEMA } from './schema.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[0-9a-f-]{72}$/i;
const initialized = new WeakSet();
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
function ensure(condition, message, status = 400) { if (!condition) throw new HttpError(status, message); }
async function digest(text) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function limitedBody(request) {
  ensure(request.headers.get('content-type')?.split(';')[0] === 'application/json', 'Use application/json.', 415);
  ensure(Number(request.headers.get('content-length') || 0) <= 12000, 'Request too large.', 413);
  const reader = request.body?.getReader(); ensure(reader, 'Missing request body.');
  let size = 0, text = ''; const decoder = new TextDecoder();
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 12000) { await reader.cancel(); throw new HttpError(413, 'Request too large.'); } text += decoder.decode(value, { stream: true }); }
  text += decoder.decode();
  try { const data = JSON.parse(text); ensure(data && typeof data === 'object' && !Array.isArray(data), 'Expected an object.'); return data; } catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, 'Invalid JSON.'); }
}
function credentials(data) { ensure(UUID.test(data.runId), 'Invalid run identifier.'); ensure(TOKEN.test(data.runToken), 'Invalid run key.'); }
async function authenticate(db, data) {
  credentials(data);
  const row = await db.prepare('SELECT * FROM runs WHERE run_id = ?').bind(data.runId).first();
  ensure(row && row.token_hash === await digest(data.runToken), 'Run not found or key incorrect.', 403);
  ensure(!row.withdrawn, 'This run has been withdrawn.', 410);
  return row;
}
async function rateLimit(db, key, limit) {
  const minute = Math.floor(Date.now() / 60000);
  const result = await db.prepare('INSERT INTO rate_windows(window_key,count) VALUES (?,1) ON CONFLICT(window_key) DO UPDATE SET count=count+1 RETURNING count').bind(`${minute}:${key}`).first();
  ensure(result.count <= limit, 'Please slow down and retry in a minute.', 429);
}
export function validateResponse(data) {
  ensure(UUID.test(data.responseId), 'Invalid response identifier.');
  ensure(data.engineVersion === ENGINE_VERSION, 'Unsupported generator version.');
  ensure(['pull', 'stay', 'skip'].includes(data.choice), 'Invalid choice.');
  ensure(['descent', 'explore', 'shared'].includes(data.source), 'Invalid response source.');
  ensure(['descent', 'explore'].includes(data.mode), 'Invalid mode.');
  ensure(Number.isInteger(data.ordinal) && data.ordinal >= 0 && data.ordinal < 5000, 'Invalid response number.');
  ensure(data.confidence == null || ['unsure', 'mixed', 'sure'].includes(data.confidence), 'Invalid confidence.');
  ensure(data.reason == null || REASONS.some(([r]) => r === data.reason), 'Invalid reason.');
  for (const key of ['activeMs', 'elapsedMs']) ensure(Number.isInteger(data[key]) && data[key] >= 0 && data[key] <= 86400000, 'Invalid response duration.');
  ensure(data.activeMs <= data.elapsedMs + 100, 'Active time exceeds elapsed time.');
  ensure(data.choice === 'skip' ? data.position === null : [0, 1].includes(data.position), 'Invalid button position.');
  if (data.mode === 'descent') { ensure(Number.isSafeInteger(data.depth) && data.depth >= 0 && data.depth < 1000000, 'Invalid journey depth.'); ensure(Number.isInteger(data.stage) && data.stage >= 0 && data.stage <= 6, 'Invalid stage.'); }
  else { ensure(data.stage == null && data.depth == null, 'Exploration must not claim a narrative stage.'); }
  let scenario;
  try { scenario = generateScenario(data.seed, { templateId: data.templateId }); } catch { throw new HttpError(400, 'Invalid stimulus.'); }
  const allowed = ['responseId','engineVersion','templateId','seed','choice','confidence','reason','activeMs','elapsedMs','position','source','depth','stage','mode','familyFilter','toneFilter','ordinal'];
  const record = Object.fromEntries(allowed.map(k => [k, data[k] ?? null]));
  for (const key of ['familyFilter', 'toneFilter']) ensure(record[key] === null || (typeof record[key] === 'string' && /^[a-z-]{1,30}$/.test(record[key])), 'Invalid filter.');
  // Quantize timings and store no client timestamp, network address, user agent, or user identifier.
  record.activeMs = Math.round(record.activeMs / 100) * 100;
  record.elapsedMs = Math.round(record.elapsedMs / 100) * 100;
  record.family = scenario.family; record.scenarioId = scenario.scenarioId;
  return record;
}
export async function aggregate(db) {
  const total = await db.prepare('SELECT COUNT(*) AS totalRuns FROM runs WHERE withdrawn=0').first();
  const counts = await db.prepare("SELECT COUNT(*) AS totalResponses, SUM(CASE WHEN choice != 'skip' THEN 1 ELSE 0 END) AS totalDecisions FROM responses").first();
  const groups = await db.prepare("SELECT family,mode,COUNT(*) AS total,SUM(CASE WHEN choice='pull' THEN 1 ELSE 0 END) AS pulled,COUNT(DISTINCT run_number) AS runs FROM responses WHERE choice!='skip' GROUP BY family,mode HAVING COUNT(DISTINCT run_number)>=10").all();
  const lengths = await db.prepare("SELECT CASE WHEN n=0 THEN '0' WHEN n<=3 THEN '1–3' WHEN n<=8 THEN '4–8' WHEN n<=14 THEN '9–14' WHEN n<=21 THEN '15–21' WHEN n<=38 THEN '22–38' ELSE '39+' END AS label,COUNT(*) AS runs,MIN(n) AS minimum FROM (SELECT r.number,COUNT(p.response_id) AS n FROM runs r LEFT JOIN responses p ON p.run_number=r.number WHERE r.withdrawn=0 GROUP BY r.number) GROUP BY label ORDER BY minimum").all();
  const stages = await db.prepare("SELECT stage,COUNT(DISTINCT run_number) AS runs,COUNT(*) AS decisions,SUM(CASE WHEN choice='pull' THEN 1 ELSE 0 END) AS pulled FROM responses WHERE mode='descent' AND choice!='skip' GROUP BY stage HAVING COUNT(DISTINCT run_number)>=10 ORDER BY stage").all();
  const enough = total.totalRuns >= 10;
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), totalRuns: total.totalRuns, totalDecisions: counts.totalDecisions || 0, totalResponses: counts.totalResponses || 0, groups: groups.results, lengths: enough ? lengths.results.filter(g => g.runs >= 10).map(({ label, runs }) => ({ label, runs })) : [], stages: stages.results, withheld: !enough || lengths.results.some(g => g.runs < 10), unit: 'run', note: 'Runs are independent playthroughs, not unique people. Small groups are suppressed. Visits with sharing disabled are not counted.' };
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS || 'https://ammarphp.github.io').split(',').map(s => s.trim());
    const cors = { 'Vary': 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    if (origin && allowed.includes(origin)) cors['Access-Control-Allow-Origin'] = origin;
    const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: cors });
    try {
      ensure(!origin || allowed.includes(origin), 'Origin not allowed.', 403);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
      const path = new URL(request.url).pathname.replace(/\/$/, '') || '/';
      if (path === '/' || path === '/health') return json({ service: 'Trolley Department anonymous run collector', version: ENGINE_VERSION, status: env.DB ? 'ready' : 'database-missing', privacy: 'Independent runs. No user IDs, IP addresses, cookies, or fingerprints stored by this app.' }, env.DB ? 200 : 503);
      ensure(env.DB, 'Database is unavailable.', 503);
      const db = env.DB;
      if (!initialized.has(db)) { await db.exec(SCHEMA); initialized.add(db); }
      if (request.method === 'GET' && path === '/stats') return json(await aggregate(db));
      ensure(request.method === 'POST' && ['/runs','/responses','/withdraw'].includes(path), 'Not found.', 404);
      const data = await limitedBody(request);
      if (path === '/runs') {
        credentials(data); ensure(data.engineVersion === ENGINE_VERSION && data.noticeVersion === CONSENT_VERSION, 'Unsupported version.');
        ensure(['descent','explore'].includes(data.mode), 'Invalid mode.');
        await rateLimit(db, 'new-runs', 120);
        await db.prepare('INSERT INTO runs(run_id,token_hash,mode,engine_version,notice_version) VALUES (?,?,?,?,?) ON CONFLICT(run_id) DO NOTHING').bind(data.runId, await digest(data.runToken), data.mode, data.engineVersion, data.noticeVersion).run();
        const row = await authenticate(db, data);
        await db.prepare("DELETE FROM rate_windows WHERE CAST(substr(window_key,1,instr(window_key,':')-1) AS INTEGER) < ?").bind(Math.floor(Date.now()/60000)-2).run();
        await db.prepare("DELETE FROM responses WHERE run_number IN (SELECT number FROM runs WHERE started_day < date('now','-365 days'))").run();
        return json({ runNumber: row.number }, 201);
      }
      const run = await authenticate(db, data);
      if (path === '/withdraw') {
        await db.batch([db.prepare('DELETE FROM responses WHERE run_number=?').bind(run.number), db.prepare('UPDATE runs SET withdrawn=1 WHERE number=?').bind(run.number)]);
        return json({ withdrawn: true });
      }
      await rateLimit(db, `run:${run.number}`, 120);
      const record = validateResponse(data);
      const existing = await db.prepare('SELECT run_number,ordinal,choice FROM responses WHERE response_id=?').bind(record.responseId).first();
      ensure(!existing || (existing.run_number === run.number && existing.ordinal === record.ordinal && existing.choice === record.choice), 'Response already belongs to another decision.', 409);
      const position = await db.prepare('SELECT response_id FROM responses WHERE run_number=? AND ordinal=?').bind(run.number, record.ordinal).first();
      ensure(!position || position.response_id === record.responseId, 'This stop is already recorded.', 409);
      await db.prepare('INSERT INTO responses(response_id,run_number,ordinal,template_id,family,choice,mode,stage,depth,active_ms,payload) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM runs WHERE number=? AND withdrawn=0) ON CONFLICT(response_id) DO UPDATE SET payload=excluded.payload').bind(record.responseId,run.number,record.ordinal,record.templateId,record.family,record.choice,record.mode,record.stage,record.depth,record.activeMs,JSON.stringify(record),run.number).run();
      return json({ accepted: true, runNumber: run.number, responseId: record.responseId });
    } catch (error) { return json({ error: error instanceof HttpError ? error.message : 'The collector could not complete the request.' }, error instanceof HttpError ? error.status : 500); }
  },
};
