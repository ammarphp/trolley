import { CONSENT_VERSION } from './engine.js';
export function publicPayload(record, run) {
  const keys = ['responseId', 'engineVersion', 'templateId', 'seed', 'choice', 'confidence', 'reason', 'activeMs', 'elapsedMs', 'position', 'source', 'depth', 'stage', 'mode', 'familyFilter', 'toneFilter', 'ordinal'];
  return { ...Object.fromEntries(keys.map(k => [k, record[k] ?? null])), consentVersion: CONSENT_VERSION,
    runId: run.id, runToken: run.token };
}
export async function api(config, path, { method = 'GET', body } = {}) {
  if (!config.collectorUrl) throw new Error('Shared collection is not connected.');
  const response = await fetch(`${config.collectorUrl.replace(/\/$/, '')}${path}`, {
    method, headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined, credentials: 'omit',
    signal: AbortSignal.timeout(10000), referrerPolicy: 'no-referrer',
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('The collector returned an invalid response.'); }
  if (!response.ok) throw new Error(data.error || 'The collector could not complete the request.');
  return data;
}
export function validConfig(config) {
  if (!config || typeof config !== 'object') return { collectorUrl: '', repositoryUrl: '' };
  for (const key of ['collectorUrl', 'repositoryUrl', 'contactUrl']) {
    if (!config[key]) continue;
    try {
      const u = new URL(config[key]);
      if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname))) config[key] = '';
    } catch { config[key] = ''; }
  }
  // A named operator and a real contact channel are required before public opt-in.
  if (!config.operatorName || !config.contactUrl) config.collectorUrl = '';
  return config;
}
