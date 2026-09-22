const KEY = 'trolley-department-v1';
const defaultState = () => ({ records: [], runs: [], runId: null, collection: true, family: 'all', tone: 'all', motion: true, sound: false, seen: [], depth: 0, runSeed: null, mode: 'descent', calm: false });
let memory;
export let storageAvailable = true;
export function loadState() {
  if (memory) return memory;
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    memory = { ...defaultState(), ...(data && typeof data === 'object' ? data : {}) };
    if (!Array.isArray(memory.records)) memory.records = [];
    if (!Array.isArray(memory.seen)) memory.seen = [];
  } catch { storageAvailable = false; memory = defaultState(); }
  return memory;
}
export function saveState(state) {
  memory = state;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { storageAvailable = false; }
}
export function clearState() { memory = defaultState(); saveState(memory); return memory; }
export function summarize(records) {
  const decisions = records.filter(r => r.choice !== 'skip');
  return { total: decisions.length, pulled: decisions.filter(r => r.choice === 'pull').length, stayed: decisions.filter(r => r.choice === 'stay').length, skipped: records.length - decisions.length, families: new Set(decisions.map(r => r.family)).size };
}
export function csv(records) {
  const keys = ['runId', 'ordinal', 'responseId', 'engineVersion', 'scenarioId', 'templateId', 'family', 'seed', 'choice', 'confidence', 'reason', 'activeMs', 'elapsedMs', 'position', 'source', 'mode', 'depth', 'stage', 'familyFilter', 'toneFilter', 'createdAt', 'title', 'prompt', 'mainOutcome', 'sideOutcome'];
  const escape = value => {
    let s = value == null ? '' : String(value);
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [keys.join(','), ...records.map(r => keys.map(k => escape(r[k])).join(','))].join('\r\n');
}
export function download(records, format) {
  const text = format === 'csv' ? csv(records) : JSON.stringify({ formatVersion: 1, exportedAt: new Date().toISOString(), records }, null, 2);
  const blob = new Blob([text], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `trolley-record-${new Date().toISOString().slice(0, 10)}.${format}`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
