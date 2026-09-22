import { generateScenario, random, ENGINE_VERSION } from './engine.js';
import { DESCENT_CATALOG } from './story-catalog.js';
export { DESCENT_CATALOG } from './story-catalog.js';
export const CHAPTERS = [
  { start: 0, name: 'Routine operations', label: 'A SMALL EXERCISE IN DECISION-MAKING', brand: 'THE TROLLEY<br>DEPARTMENT', notice: 'A few hypothetical choices. Take your time.', status: 'ALL SYSTEMS NORMAL', speed: '1×', family: ['classic'] },
  { start: 3, name: 'Acceptable losses', label: 'THE EXERCISE IS PROCEEDING AS EXPECTED', brand: 'THE TROLLEY<br>DEPARTMENT', notice: 'Some discomfort is an expected part of the process.', status: 'LOSSES WITHIN TOLERANCE', speed: '2×', family: ['classic', 'numbers', 'relationships'] },
  { start: 8, name: 'A little assistance', label: 'HUMAN OVERSIGHT REMAINS IN PLACE', brand: 'THE TROLLEY<br>DEPARTMENT', notice: 'A recommendation is not a decision. For now.', status: 'OPTIMIZATION ENABLED', speed: '8×', family: ['uncertainty', 'responsibility', 'consent'] },
  { start: 14, name: 'Competitive pressure', label: 'PAUSING WOULD PUT US AT A DISADVANTAGE', brand: 'THE ACCELERATION<br>DEPARTMENT', notice: 'The other trolley is not waiting for us.', status: 'SAFETY REVIEW DEFERRED', speed: '64×', family: ['systems', 'incentives', 'personhood'] },
  { start: 21, name: 'Recursive improvement', label: 'THE SYSTEM IS IMPROVING THE SYSTEM', brand: 'THE ACCELERATION<br>DEPARTMENT', notice: 'The definition of improvement was improved overnight.', status: 'OVERSIGHT BOTTLENECK DETECTED', speed: '4,096×', family: ['personhood', 'time', 'absurd'] },
  { start: 29, name: 'An implementation detail', label: 'YOUR INPUT IS STILL VALUED', brand: 'THE CONTINUATION<br>DEPARTMENT', notice: 'The people have been converted into a more convenient unit.', status: 'HUMAN-READABLE MODE DEPRECATED', speed: '16,777,216×', family: ['time', 'meta', 'personhood'] },
  { start: 38, name: 'There is no final stop', label: 'CONTINUATION IS THE OBJECTIVE', brand: 'THE<br>DEPARTMENT', notice: 'There was going to be a destination.', status: 'OBJECTIVE PRESERVED / EVERYTHING ELSE OPTIONAL', speed: '∞', family: ['meta', 'absurd', 'systems', 'time'] },
];

export function chapterAt(depth) {
  let stage = 0;
  for (let i = 0; i < CHAPTERS.length; i++) if (depth >= CHAPTERS[i].start) stage = i;
  return { ...CHAPTERS[stage], stage };
}
export function generateDescent(runSeed, depth, seen = [], branch = { route: 'unassigned', key: 'start' }) {
  if (!Number.isSafeInteger(depth) || depth < 0) throw new Error('Invalid journey depth.');
  const chapter = chapterAt(depth);
  const seed = `${runSeed}-${depth.toString(36)}-${branch.key || 'start'}`;
  const rng = random(`${seed}:descent`);
  let template;
  if (depth < 3) template = DESCENT_CATALOG[depth];
  else if (depth === 3) template = { id: 'classic-switch' };
  else if (depth === 14) template = { id: 'race-rebuke' };
  else {
    const stories = DESCENT_CATALOG.filter(t => t.stage === chapter.stage && !seen.includes(t.id));
    const allStories = DESCENT_CATALOG.filter(t => t.stage === chapter.stage);
    // First stop of each chapter and two out of three later stops carry the narrative.
    const useStory = allStories.length && (depth === chapter.start || depth % 3 !== 1);
    if (useStory) { const pool = stories.length ? stories : allStories; const bias = branch.route === 'optimization' ? 2 : branch.route === 'preservation' ? 1 : 0; template = pool[(Math.floor(rng() * pool.length) + bias) % pool.length]; }
  }
  const family = chapter.family[Math.floor(rng() * chapter.family.length)];
  const scenario = generateScenario(seed, template ? { templateId: template.id } : { family, exclude: seen });
  return { ...scenario, depth, stage: chapter.stage, mode: 'descent', runSeed, route: branch.route, branchKey: branch.key, narrativeVersion: ENGINE_VERSION };
}
