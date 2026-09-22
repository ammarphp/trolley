import { newSeed } from './engine.js';
export function createRun(mode = 'descent') {
  return { id: crypto.randomUUID(), token: crypto.randomUUID() + crypto.randomUUID(), number: null, seed: newSeed(), mode, registered: false, sharing: true };
}
export function ensureRun(state) {
  state.runs ||= [];
  let run = state.runs.find(r => r.id === state.runId);
  if (!run) { run = createRun(state.mode || 'descent'); state.runs.push(run); state.runId = run.id; state.runSeed = run.seed; }
  return run;
}
export function startRun(state, mode = 'descent') {
  const run = createRun(mode);
  run.sharing = state.collection !== false;
  state.runs.push(run); state.runId = run.id; state.runSeed = run.seed; state.depth = 0; state.mode = mode; state.seen = [];
  return run;
}
export function runRecords(state, runId = state.runId) { return state.records.filter(r => r.runId === runId); }
export function branchState(records) {
  let interventions = 0, omissions = 0, skips = 0;
  for (const r of records) { if (r.choice === 'pull') interventions++; else if (r.choice === 'stay') omissions++; else skips++; }
  const total = interventions + omissions;
  const route = total < 3 ? 'unassigned' : interventions / total >= .65 ? 'optimization' : interventions / total <= .35 ? 'preservation' : 'oscillation';
  return { interventions, omissions, skips, route, key: records.map(r => r.choice[0]).join('').slice(-24) || 'start' };
}
