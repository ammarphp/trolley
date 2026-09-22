import { CATALOG, FAMILIES } from './catalog.js';
import { DESCENT_CATALOG } from './story-catalog.js';
export const ALL_TEMPLATES = [...CATALOG, ...DESCENT_CATALOG];
export const ENGINE_VERSION = '1.0.0';
export const CONSENT_VERSION = '2026-09-22.1';
export function hash(text) {
  let h = 2166136261;
  for (const char of String(text)) { h ^= char.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function random(seed) {
  let a = hash(seed);
  return () => {
    a += 0x6D2B79F5;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function newSeed() {
  return Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join('-');
}
export function eligibleTemplates({ family = 'all', tone = 'all' } = {}) {
  return CATALOG.filter(t => (family === 'all' || t.family === family) &&
    (tone === 'all' || (tone === 'straight' ? t.weirdness === 0 : t.weirdness > 0)));
}
export function generateScenario(seed, { templateId, family = 'all', tone = 'all', exclude = [] } = {}) {
  if (typeof seed !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(seed)) throw new Error('Invalid scenario seed.');
  const rng = random(`${ENGINE_VERSION}:${seed}`);
  const pick = items => items[Math.floor(rng() * items.length)];
  const candidates = eligibleTemplates({ family, tone });
  let template = templateId ? ALL_TEMPLATES.find(t => t.id === templateId) : null;
  if (templateId && !template) throw new Error('Unknown template.');
  if (!template) {
    if (!candidates.length) throw new Error('No dilemmas match those filters.');
    const fresh = candidates.filter(t => !exclude.includes(t.id));
    // Family-balanced selection in mixed mode, then uniform within family.
    const pool = fresh.length ? fresh : candidates;
    const chosenFamily = pick([...new Set(pool.map(t => t.family))]);
    template = pick(pool.filter(t => t.family === chosenFamily));
  }
  // Derive parameter randomness independently of catalog/filter selection.
  const prng = random(`${ENGINE_VERSION}:${seed}:${template.id}:parameters`);
  const parameter = items => items[Math.floor(prng() * items.length)];
  const many = template.fixedMany ?? parameter([3, 4, 5, 6, 8, 10, 12, 20]);
  const few = template.fixedFew ?? (template.almostEqual ? many - 1 : parameter([1, 1, 2]));
  const values = { many, few, oneLess: many - 1, total: many + 1, chance: parameter([10, 25, 50, 75, 90, 99]), years: parameter([1, 5, 25, 100]), fewPeople: `${few} ${few === 1 ? 'person' : 'people'}` };
  const interpolate = s => s.replace(/\{(\w+)\}/g, (_, key) => String(values[key]));
  const out = { ...template };
  for (const [key, value] of Object.entries(out)) if (typeof value === 'string') out[key] = interpolate(value);
  // Grammatical agreement in generated consequences.
  out.side = out.side.replace(/^1 person die\./, '1 person dies.');
  out.main = out.main.replace(/^1 person die\./, '1 person dies.');
  if (template.reverseCounts && template.mainLabel === '{many} people') out.mainLabel = values.fewPeople;
  if (template.reverseCounts && template.sideLabel === '{fewPeople}') out.sideLabel = `${many} people`;
  return { ...out, seed, version: ENGINE_VERSION, scenarioId: `${ENGINE_VERSION}:${template.id}:${seed}`, params: values,
    familyName: FAMILIES.find(f => f.id === template.family).name,
    mainCount: template.reverseCounts ? few : many,
    sideCount: template.unknownSide ? null : template.reverseCounts ? many : few,
  };
}
export function scenarioUrl(scenario, base) {
  const url = new URL(base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('v', scenario.version);
  url.searchParams.set('case', scenario.id);
  url.searchParams.set('seed', scenario.seed);
  return url.toString();
}
export function fromUrl(url) {
  const params = new URL(url).searchParams;
  if (!params.has('case') && !params.has('seed')) return null;
  if (params.get('v') !== ENGINE_VERSION) throw new Error('This link uses a different edition of the generator. The current edition has been opened instead.');
  return generateScenario(params.get('seed'), { templateId: params.get('case') });
}
export const REASONS = [
  ['harm', 'Reduce harm'], ['duty', 'Follow a principle'], ['care', 'Protect someone'],
  ['consent', 'Respect consent'], ['fairness', 'Be fair'], ['instinct', 'Gut feeling'], ['absurdity', 'Embrace the absurdity'],
];
export const REMARKS = [
  'Your decision has been filed under “complicated.”',
  'The committee appreciates your willingness to be the committee.',
  'A choice was made. That is as far as the department will go.',
  'Your moral consistency is between you and your next dilemma.',
  'Thank you. There is, unfortunately, another trolley.',
  'The paperwork is lighter than the implications.',
];
