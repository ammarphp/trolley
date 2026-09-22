import { CATALOG, FAMILIES, TONES } from './catalog.js';
import { ALL_TEMPLATES, ENGINE_VERSION, CONSENT_VERSION, generateScenario, newSeed, fromUrl, scenarioUrl, REASONS, REMARKS, hash, eligibleTemplates } from './engine.js';
import { CHAPTERS, chapterAt, generateDescent } from './descent.js';
import { loadState, saveState, clearState, summarize, download, storageAvailable } from './storage.js';
import { scene, animateChoice, escapeHTML as e } from './scene.js';
import { api, validConfig, publicPayload } from './collector-client.js';
import { ensureRun, startRun, runRecords, branchState } from './runs.js';
import { runCharts, aggregateCharts } from './charts.js';
import { createGameScene } from './game-scene.js';
import { playCopy } from './play-copy.js';

const $ = selector => document.querySelector(selector);
let state = loadState();
let activeRun = ensureRun(state);
// Pre-release storage migration removes the old, unused person-level model.
delete state.participantId; delete state.deleteToken; delete state.consent; saveState(state);
for (const [i, record] of state.records.entries()) if (!record.runId) { record.runId = activeRun.id; record.ordinal = i; record.shareAllowed = false; }
if (new URL(location.href).searchParams.has('private')) { activeRun.sharing = false; state.collection = false; }
saveState(state);
if (!Number.isSafeInteger(state.depth) || state.depth < 0) state.depth = 0;
let config = { collectorUrl: '', repositoryUrl: '' };
let current, currentRecord, view = 'experiment', animating = false, paused = false;
let startAt = performance.now(), activeStart = startAt, activeMs = 0;
let source = 'descent', toastTimer, sending = false, resyncRequested = false, initialMessage = '';
let choiceFinished = Promise.resolve(), resolveChoice;
const main = $('#main');
let gameScene, autoNextTimer, interludeTimer;
const shownInterludes = new Set();

function toast(message) {
  clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').classList.add('visible');
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000);
}
function resetTimer() { startAt = performance.now(); activeMs = 0; activeStart = document.hidden ? null : startAt; }
function pauseTimer() { if (activeStart !== null) activeMs += performance.now() - activeStart; activeStart = null; }
function resumeTimer() { if (activeStart === null && !document.hidden && view === 'experiment' && !currentRecord && !paused && !$('dialog[open]')) activeStart = performance.now(); }
document.addEventListener('visibilitychange', () => document.hidden ? pauseTimer() : resumeTimer());
window.addEventListener('blur', pauseTimer);
window.addEventListener('focus', resumeTimer);
function reducedMotion() { return !state.motion || matchMedia('(prefers-reduced-motion: reduce)').matches; }
function applyAtmosphere() {
  const stage = view === 'experiment' && state.mode === 'descent' && current?.mode === 'descent' ? chapterAt(current.depth).stage : 0;
  document.body.dataset.stage = String(state.calm ? 0 : stage);
  document.body.classList.toggle('no-motion', reducedMotion());
  document.body.classList.toggle('paused', paused);
  $('.brand span').innerHTML = state.mode === 'descent' ? CHAPTERS[stage].brand : CHAPTERS[0].brand;
}
function loadNext({ templateId } = {}) {
  currentRecord = null; paused = false;
  if (templateId) { current = generateScenario(newSeed(), { templateId }); source = 'explore'; }
  else if (state.mode === 'descent') { current = generateDescent(state.runSeed, state.depth, state.seen, branchState(runRecords(state))); source = 'descent'; }
  else { current = generateScenario(newSeed(), { family: state.family, tone: state.tone, exclude: state.seen }); source = 'explore'; }
  resetTimer(); applyAtmosphere();
}
function headerState() {
  document.querySelectorAll('.nav-link').forEach(button => {
    button.classList.toggle('active', button.dataset.view === view);
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  $('#record-count').textContent = summarize(state.records).total;
}
function render() {
  clearTimeout(autoNextTimer); clearTimeout(interludeTimer); gameScene?.destroy(); gameScene = null;
  document.body.classList.toggle('playing', view === 'experiment');
  headerState(); applyAtmosphere();
  if (view === 'experiment') renderExperiment();
  if (view === 'record') renderRecord();
  if (view === 'guide') renderGuide();
}
function currentChapter() { return current.mode === 'descent' ? chapterAt(current.depth) : CHAPTERS[0]; }
function renderExperiment() {
  clearTimeout(autoNextTimer); clearTimeout(interludeTimer); gameScene?.destroy();
  if (paused) {
    main.innerHTML = `<div class="game-pause"><h1>It can wait.</h1><p>The trolley is made up. You can leave.<br>Your place is saved.</p><div class="button-row"><button id="resume">Back on the trolley</button><button data-view="record">This run’s report</button><button id="pause-settings">Settings</button></div></div>`;
    $('#resume').onclick=()=>{paused=false;render();resumeTimer();};$('#pause-settings').onclick=openSettings;return;
  }
  const index=current.mode==='descent'?current.depth+1:runRecords(state).length+1;
  const copy=playCopy(current);
  main.innerHTML=`<canvas id="game-canvas" class="game-canvas" role="img" aria-label="A hand-drawn controller rides behind a constantly moving trolley toward two tracks. Left and right routes are labeled in the scene. The buttons below name the affected groups."></canvas>
    <div class="game-hud"><span class="game-counter">${String(index).padStart(3,'0')}</span><button id="game-report" aria-label="Run report" title="Run report">▥</button><button id="game-menu" aria-label="Preferences, data and restart" title="Preferences">···</button><button id="pause" class="hud-pause" aria-label="Pause and step outside" title="Pause">Ⅱ</button></div>
    <div class="game-story"><h1 id="case-title" class="${current.depth===14?'taunt':''}">${e(copy.prompt)}</h1>${copy.note?`<p class="scene-note">${e(copy.note)}</p>`:''}</div>
    <div class="game-decisions" id="decision-area">${currentRecord?resultHTML():choiceHTML()}</div>
    <button class="game-data-notice" id="data-mode">${activeRun.sharing&&config.collectorUrl?'Anonymous run data is shared · opt out':'This run stays on your device · data settings'}</button>`;
  gameScene=createGameScene($('#game-canvas'),current,{motion:!reducedMotion(),calm:state.calm});
  document.body.style.setProperty('--game-paper',gameScene.colors.paper);document.body.style.setProperty('--game-ink',gameScene.colors.ink);
  $('#game-report').onclick=()=>{pauseTimer();syncPending();view='record';render();};$('#game-menu').onclick=openSettings;
  $('#pause').onclick=stepOutside;$('#data-mode').onclick=openSettings;bindDecisions();
  if(initialMessage){toast(initialMessage);initialMessage='';}
  if(!currentRecord&&current.mode==='descent'&&[21,29,38].includes(current.depth)&&!shownInterludes.has(current.scenarioId)&&!reducedMotion()&&!state.calm){
    shownInterludes.add(current.scenarioId);pauseTimer();
    const panel=document.createElement('div');panel.className='game-interlude';panel.innerHTML=`<p>${{21:'Just a moment. It is improving itself.',29:'Still there? It kept the part of you it needed.',38:'There was going to be a destination.'}[current.depth]}</p><button>Skip the pause →</button>`;main.append(panel);
    const close=()=>{panel.remove();clearTimeout(interludeTimer);resumeTimer();};panel.querySelector('button').onclick=close;interludeTimer=setTimeout(close,3400);
  }
}
function choiceHTML() {
  const order=hash(`${current.scenarioId}:order`)%2?['pull','stay']:['stay','pull'];
  return `<div class="game-choices">${order.map((choice,i)=>`<button class="game-choice" data-choice="${choice}" aria-label="${i===0?'Left':'Right'}: ${e(choice==='pull'?current.side:current.main)}"><small>${i+1}</small><span class="arrow" aria-hidden="true">${i===0?'↖':'↗'}</span><span>${e(choice==='pull'?current.sideLabel:current.mainLabel)}</span></button>`).join('')}</div><div class="game-utilities"><button id="skip">skip</button><button id="share">share</button><button id="explore">another track?</button></div>`;
}
function resultHTML() {
  const r=currentRecord;
  const outcome=r.choice==='skip'?'You look away. It keeps going.':r.choice==='pull'?current.side:current.main;
  return `<p class="game-outcome" id="result-title" tabindex="-1" role="status">${e(outcome)}</p><button class="game-next" id="next">On we go. →</button><div class="game-result-options"><button id="reflect">wait, I have thoughts</button><button id="share">share this stop</button></div>`;
}
function openReflection(){
  clearTimeout(autoNextTimer);
  const panel=document.createElement('div');panel.className='game-reflection';
  panel.innerHTML=`<p>Why that choice? Optional.</p><div>${REASONS.map(([id,label])=>`<button class="chip ${currentRecord.reason===id?'selected':''}" data-reason="${id}" aria-pressed="${currentRecord.reason===id}">${label}</button>`).join('')}</div><p style="margin-top:16px">How sure?</p><div>${[['unsure','Not really'],['mixed','A bit'],['sure','Very']].map(([id,label])=>`<button class="chip" data-confidence="${id}" aria-pressed="${currentRecord.confidence===id}">${label}</button>`).join('')}</div><button class="close-reflection">Done. Keep going. →</button>`;
  $('#decision-area').append(panel);bindDecisions();panel.querySelector('.close-reflection').onclick=next;
}

function bindDecisions() {
  if($('#explore'))$('#explore').onclick=openExplore;
  if($('#reflect'))$('#reflect').onclick=openReflection;
  document.querySelectorAll('[data-choice]').forEach(button => button.onclick = () => choose(button.dataset.choice));
  if ($('#skip')) $('#skip').onclick = () => choose('skip');
  if ($('#share')) $('#share').onclick = share;
  if ($('#next')) $('#next').onclick = next;
  document.querySelectorAll('[data-confidence],[data-reason]').forEach(button => button.onclick = () => {
    const key = button.dataset.confidence ? 'confidence' : 'reason';
    const value = button.dataset[key]; currentRecord[key] = currentRecord[key] === value ? null : value; currentRecord.shared = false;
    saveState(state);
    document.querySelectorAll(`[data-${key}]`).forEach(b => { b.classList.toggle('selected', b.dataset[key] === currentRecord[key]); b.setAttribute('aria-pressed', String(b.dataset[key] === currentRecord[key])); });
  });
}
function choose(choice, agent = false) {
  if ($('.game-interlude') || currentRecord || animating || paused || view !== 'experiment' || !['pull', 'stay', 'skip'].includes(choice)) return;
  pauseTimer();
  choiceFinished = new Promise(resolve => { resolveChoice = resolve; });
  const order = hash(`${current.scenarioId}:order`) % 2 ? ['pull', 'stay'] : ['stay', 'pull'];
  currentRecord = {
    runId: activeRun.id, ordinal: activeRun.nextOrdinal ?? runRecords(state).length, responseId: crypto.randomUUID(), engineVersion: ENGINE_VERSION, scenarioId: current.scenarioId,
    templateId: current.id, family: current.family, seed: current.seed, title: current.title,
    prompt: playCopy(current).prompt, note: playCopy(current).note, fullSetup: current.setup, mainOutcome: current.main, sideOutcome: current.side,
    choice, confidence: null, reason: null, activeMs: Math.min(86400000, Math.round(activeMs)), elapsedMs: Math.min(86400000, Math.round(performance.now() - startAt)),
    position: choice === 'skip' ? null : order.indexOf(choice), source: agent ? 'agent' : source,
    depth: current.depth ?? null, stage: current.stage ?? null, mode: current.mode || 'explore',
    familyFilter: state.family, toneFilter: state.tone, route: current.route ?? null, branchKey: current.branchKey ?? null, createdAt: new Date().toISOString(),
    shareAllowed: activeRun.sharing && !agent, shared: false,
  };
  activeRun.nextOrdinal = currentRecord.ordinal + 1;
  state.records.push(currentRecord);
  // Retain 5,000 local responses. Each run has its own separate withdrawal key.
  if (state.records.length > 5000) state.records.splice(0, state.records.length - 5000);
  state.seen = [...new Set([...state.seen, current.id])].slice(-100);
  if (current.mode === 'descent') state.depth = current.depth + 1;
  saveState(state); headerState(); syncPending();
  document.querySelectorAll('[data-choice],#skip').forEach(b => b.disabled = true);
  const finish = () => {
    animating = false; resolveChoice?.();
    if (view !== 'experiment' || paused) return;
    $('#decision-area').innerHTML = resultHTML(); bindDecisions();
    $('#result-title').focus({ preventScroll: true });
    if(!reducedMotion())autoNextTimer=setTimeout(()=>{if(!paused&&view==='experiment'&&!$('dialog[open]'))next();},4200);
  };
  if (choice === 'skip') finish();
  else { animating = true; playSound(); gameScene.choose(choice, finish); }
}
function next() {
  clearTimeout(autoNextTimer);
  if (animating || !currentRecord) return;
  syncPending(); loadNext(); render();
  $('#case-title')?.setAttribute('tabindex', '-1'); $('#case-title')?.focus({ preventScroll: true });
  if (innerWidth < 640) window.scrollTo({ top: 0, behavior: reducedMotion() ? 'instant' : 'smooth' });
}
function stepOutside() { clearTimeout(autoNextTimer); if(animating){animating=false;resolveChoice?.();} pauseTimer(); paused=true;render();$('#resume')?.focus(); }
async function share() {
  const url = scenarioUrl(current, location.href);
  try { await navigator.clipboard.writeText(url); toast('Exact dilemma link copied. The recipient starts in a clean interface.'); }
  catch {
    const input = document.createElement('input'); input.className = 'share-fallback'; input.value = url; input.readOnly = true; input.setAttribute('aria-label', 'Shareable dilemma URL');
    $('#decision-area').append(input); input.select(); toast('Copy the selected link.');
  }
}
function renderRecord(selectedRunId = state.runId) {
  const selected = state.runs.find(r => r.id === selectedRunId) || activeRun;
  const records = runRecords(state, selected.id), stats = summarize(records);
  main.innerHTML = `<div class="page-heading"><p class="eyebrow">THE RUN REPORT</p><h1>This is how it went.</h1><p>A trajectory through the machine. Not a profile of the person playing.</p></div>
    <div class="report-toolbar"><label for="run-select">Run</label><select id="run-select">${state.runs.map((r, i) => `<option value="${r.id}" ${r.id === selected.id ? 'selected' : ''}>${r.number ? 'Public run ' + r.number : 'Local run ' + (i + 1)} · ${r.mode} · ${runRecords(state,r.id).length} stops</option>`).join('')}</select><div class="button-row"><button class="secondary-button" id="export-json" ${records.length ? '' : 'disabled'}>JSON ↓</button><button class="secondary-button" id="export-csv" ${records.length ? '' : 'disabled'}>CSV ↓</button><button class="secondary-button" id="export-chart" ${records.length ? '' : 'disabled'}>Charts SVG ↓</button></div></div>
    <div class="stats"><div class="stat"><strong>${stats.total}</strong><span>decisions in this run</span></div><div class="stat"><strong>${stats.total ? Math.round(stats.pulled/stats.total*100)+'%' : '—'}</strong><span>chose to intervene</span></div><div class="stat"><strong>${stats.skipped}</strong><span>left unresolved</span></div><div class="stat"><strong>${Math.max(0,...records.map(r => (r.stage ?? -1)+1))}<small> / 7</small></strong><span>stages reached</span></div></div>
    ${runCharts(records)}<div class="section-row"><h2>The paper trail</h2><button class="text-button" data-view="experiment">Back to the trolley →</button></div>
    ${records.length ? `<details><summary>Inspect ${records.length} decisions</summary><div class="record-list">${records.slice(-100).reverse().map(r => `<div class="record-row ${r.choice}"><span class="record-icon" aria-hidden="true">${r.choice==='pull'?'↗':r.choice==='stay'?'→':'·'}</span><div><h3>${e(r.title)}</h3><p>Stop ${r.ordinal+1} · ${(r.activeMs/1000).toFixed(1)}s active time</p></div><div class="record-choice">${r.choice==='pull'?'Intervened':r.choice==='stay'?'Let it continue':'Skipped'}</div></div>`).join('')}</div></details>` : '<div class="empty-state"><h2>Nothing filed. Yet.</h2><p>The first decision will bring the charts to life.</p></div>'}
    <div class="community"><div class="section-row"><h2>Every run through the department</h2><button class="secondary-button" id="load-community">Refresh live results</button></div><p>One playthrough, one entry. No user accounts, visitor IDs, or cross-run profiles. Ten runs by one person are ten runs.</p><div id="community-results" aria-live="polite"><p>Loading the aggregate snapshot…</p></div></div>`;
  $('#run-select').onchange = event => renderRecord(event.target.value);
  $('#export-json').onclick = () => download(records,'json'); $('#export-csv').onclick = () => download(records,'csv');
  $('#export-chart').onclick = () => {
    const charts = [...main.querySelectorAll('.charts-grid svg')];
    const group = charts.map((svg,i) => `<g transform="translate(20 ${i*205+35})"><text x="0" y="0" font-family="Arial" font-size="14" fill="#24321d">${['Decisions','Active response time','Narrative trajectory'][i]}</text><svg y="12" width="550" height="175" viewBox="${svg.getAttribute('viewBox')}">${svg.innerHTML}</svg></g>`).join('');
    const css = 'text{fill:#24321d;font:12px Arial}.chart-axis{stroke:#9aaa8c}.chart-grid{stroke:#d8dfcd;fill:none}.chart-line{stroke:#75943c;stroke-width:2}.chart-point{fill:#75943c}';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="${charts.length*205+30}" style="--chart-a:#75943c;--chart-b:#435064;--chart-c:#bec7af"><rect width="100%" height="100%" fill="#f5f5f0"/><style>${css}</style>${group}</svg>`;
    const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})), a=document.createElement('a'); a.href=url; a.download=`trolley-run-${selected.number || 'local'}-charts.svg`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  $('#load-community').onclick = () => loadCommunity(true);
  loadCommunity(false);
}
async function loadCommunity(live) {
  const target = $('#community-results'); if (!target) return;
  try {
    let data;
    if (live && config.collectorUrl) data = await api(config,'/stats');
    else { const response=await fetch('./aggregate.json'); if (!response.ok) throw new Error('No snapshot'); data=await response.json(); }
    if (target.isConnected) target.innerHTML = aggregateCharts(data);
  } catch { if (target.isConnected) target.innerHTML = '<p>No shared results are available yet. Local run charts work independently.</p>'; }
}

function renderGuide() {
  main.innerHTML = `<div class="page-heading"><p class="eyebrow">A FIELD GUIDE TO THE DEPARTMENT</p><h1>Same trolley.<br>Different excuses.</h1><p>An endless sequence of increasingly uncomfortable choices. Part thought experiment, part very questionable public infrastructure.</p></div>
  <div class="guide-intro"><div><p>You begin with coffee. Each decision moves you a little further. Recommendations become instructions, safety becomes a delay, and eventually the people become a rounding error.</p><p>This is a fictional metaphor for competitive AI development, delegation, and recursive self-improvement. Its outcomes are stipulated, not predictions about real AI systems.</p></div><div class="guide-callout">The descent is intentional. You can step outside at any time, keep the visuals calm in preferences, or explore individual dilemmas without the progression. There is no score to maximize and no ending to earn.</div></div>
  <div class="section-row"><h2>${ALL_TEMPLATES.length} templates. Twelve lines of inquiry.</h2><button class="secondary-button" id="guide-explore">Explore the catalog ↗</button></div><div class="guide-grid">${FAMILIES.map(f => `<article class="guide-card"><p class="eyebrow">${f.code} / ${CATALOG.filter(t => t.family === f.id).length} CORE TEMPLATES</p><h3>${e(f.name)}</h3><p>${e(f.question)}</p><button class="text-button" data-family="${f.id}">Explore this theme →</button></article>`).join('')}</div>
  <div class="details-stack"><details><summary>What does “endless” mean?</summary><p>The journey has seven stages of escalation and no final stop. After the last stage, dilemmas continue from a seeded template system. There are ${ALL_TEMPLATES.length} authored templates; wording and parameter combinations are finite. New seeds do not mean infinitely many philosophically distinct questions. No AI is generating text while you play.</p></details>
  <details><summary>What is actually recorded?</summary><p>Locally: the exact dilemma, generator version, seed, choice or skip, optional confidence and reason, button position, active viewing time, elapsed time, narrative stage, mode, filters, and response time. A maximum of 5,000 local responses is retained. Exports are available in Your record.</p><p>When a collector is connected, anonymous run statistics are shared with a notice beside the play controls. You can turn sharing off or withdraw this run. Each new run has a fresh random identifier. No name, email, free text, or browser fingerprint is requested. The hosting and network providers still process normal connection metadata. The app does not claim that network access is anonymous.</p></details>
  <details><summary>Could these responses support research?</summary><p>They can support exploratory analysis. This is a convenience sample with self-selection, narrative exposure, repeated responses, humor, and deliberate visual changes. The descent confounds content, order, and presentation by design. Do not interpret it as a controlled causal experiment, a population estimate, or a diagnostic instrument.</p><p>Exploration is separate from the descent in the exported data. Button positions are counterbalanced deterministically. Seeds and versions let you reconstruct stimuli. Serious research would require a separate preregistered design, review where applicable, and an appropriate sampling plan.</p></details>
  <details><summary>Can I change my mind, delete my data, or leave?</summary><p>You can skip any question, leave at any time, or stop future sharing in preferences. Choosing an answer records that choice; later reflection can be expressed through optional confidence and reason. There is no moral score. Each run can be withdrawn using its own deletion key held on this device. Clearing that key before withdrawal removes the app’s ability to identify your shared records.</p></details>
  <details><summary>Why a trolley?</summary><p>The familiar switch dilemma isolates a conflict between reducing harm and actively causing it. The original philosophical literature is much richer than a two-button interface. This project deliberately shows how a narrow choice can conceal assumptions about who counts, what gets measured, and who designed the tracks.</p><p>Background: Philippa Foot, “The Problem of Abortion and the Doctrine of the Double Effect” (1967), and Judith Jarvis Thomson, “The Trolley Problem” (1985). See the repository’s methodology document for the catalog, limitations, and design notes.</p></details></div>
  <div class="button-row"><button class="primary-button" data-view="experiment">Back to the trolley →</button><button class="secondary-button" id="guide-privacy">Data & privacy</button></div>`;
  $('#guide-explore').onclick = openExplore; $('#guide-privacy').onclick = openSettings;
  document.querySelectorAll('[data-family]').forEach(b => b.onclick = () => beginExploration(b.dataset.family));
}
function openDialog(dialog) { clearTimeout(autoNextTimer); pauseTimer(); dialog.showModal(); }
function openSettings() {
  const dialog = $('#settings-dialog');
  dialog.innerHTML = `<div class="dialog-head"><div><p class="eyebrow">THIS PART REALLY IS UNDER YOUR CONTROL</p><h2 id="settings-title">Your terms.</h2></div><button class="icon-button close-dialog" aria-label="Close preferences">×</button></div>
    <div class="setting-row"><label for="motion">Animation<small>System reduced-motion settings always take priority.</small></label><input class="toggle" id="motion" type="checkbox" ${state.motion?'checked':''}></div>
    <div class="setting-row"><label for="calm">Keep the visuals calm<small>The story continues. The interface stays clean.</small></label><input class="toggle" id="calm" type="checkbox" ${state.calm?'checked':''}></div>
    <div class="setting-row"><label for="sound">Sound<small>A quiet mechanical tone. Off by default.</small></label><input class="toggle" id="sound" type="checkbox" ${state.sound?'checked':''}></div>
    <div class="setting-row"><label for="collection">Share anonymous run statistics<small>${config.collectorUrl?'No account or visitor identity. A fresh record for every new run.':'Collector not connected. This run is local only.'}</small></label><input class="toggle" id="collection" type="checkbox" ${activeRun.sharing?'checked':''} ${config.collectorUrl?'':'disabled'}></div>
    <div class="privacy-box"><p>One run gets one random ID and a public run number. A new run gets an unrelated ID. There is no shared user identifier, fingerprint, advertising tracker, or cross-run profile.</p><p>Shared data includes choices, skips, optional reflections, rounded response timing, button order, and narrative stage. The app stores no IP addresses or user agents. Hosting providers still process ordinary network metadata. Raw responses are eligible for cleanup after 365 days, when new runs register.</p><p>Only aggregates are public and copied to GitHub. Small groups are withheld. Historical aggregate snapshots can remain in Git history after you withdraw a run.</p>${config.operatorName?`<p>Operated by ${e(config.operatorName)}. <a href="${e(config.contactUrl)}" target="_blank" rel="noopener noreferrer">Contact / source ↗</a></p>`:''}</div>
    <div class="filter-group"><label for="withdraw-select">Run to withdraw</label><select id="withdraw-select">${state.runs.map((r,i)=>`<option value="${r.id}" ${r.id===activeRun.id?'selected':''}>${r.number?'Public run '+r.number:'Local run '+(i+1)}${r.withdrawn?' (withdrawn)':''}</option>`).join('')}</select></div><div class="dialog-actions"><button class="secondary-button" id="download-data">Export this run</button><button class="secondary-button danger" id="withdraw-run">Withdraw this run</button><button class="secondary-button danger" id="erase-local">Erase local data</button></div>
    <div class="setting-row restart-row"><label>A new run<small>Start with coffee and a fresh, unrelated run ID.</small></label><button class="secondary-button" id="restart">Start over</button></div><p class="small-copy">Notice ${CONSENT_VERSION}. Sharing is disclosed beside the play controls and can be disabled at any time.</p>`;
  dialog.querySelector('.close-dialog').onclick = () => dialog.close();
  for (const key of ['motion','calm','sound']) dialog.querySelector('#'+key).onchange = event => { state[key]=event.target.checked; saveState(state); if(animating){animating=false;resolveChoice?.();} render(); };
  $('#collection').onchange = event => {
    state.collection=event.target.checked; activeRun.sharing=state.collection;
    if (!state.collection) runRecords(state).forEach(r=>{if(!r.shared)r.shareAllowed=false;});
    saveState(state); render(); toast(state.collection?'Future run decisions will be shared.':'Future sharing stopped. Use Withdraw to remove earlier shared choices.'); if(state.collection)syncPending();
  };
  $('#download-data').onclick=()=>download(runRecords(state),'json');
  $('#withdraw-run').onclick=async event=>{
    const button=event.target;button.disabled=true;const run=state.runs.find(r=>r.id===$('#withdraw-select').value);run.sharing=false;if(run===activeRun)state.collection=false;saveState(state);
    try {
      if(run.registered&&!run.withdrawn)await api(config,'/withdraw',{method:'POST',body:{runId:run.id,runToken:run.token}});
      run.withdrawn=true; run.registered=false; runRecords(state,run.id).forEach(r=>{r.shared=false;r.shareAllowed=false;}); saveState(state); dialog.close(); render(); toast('This run has been withdrawn. Your local copy remains.');
    }catch{button.disabled=false;toast('Withdrawal could not reach the collector. Sharing is off; the run key is preserved for retry.');}
  };
  $('#erase-local').onclick=()=>{
    if(state.runs.some(r=>r.registered&&!r.withdrawn)){toast('Withdraw shared runs first. Exported responses never include deletion keys.');return;}
    if(!confirm('Permanently erase all locally saved runs and preferences?'))return;
    state=clearState(); activeRun=ensureRun(state); saveState(state); loadNext(); dialog.close(); view='experiment'; render();
  };
  $('#restart').onclick=()=>{syncPending();activeRun=startRun(state);saveState(state);loadNext();dialog.close();view='experiment';render();syncPending();};
  openDialog(dialog);
}

function openExplore() {
  const dialog = $('#explore-dialog');
  dialog.innerHTML = `<div class="dialog-head"><div><p class="eyebrow">THE DEPARTMENT ARCHIVE</p><h2 id="explore-title">Choose your discomfort.</h2></div><button class="icon-button close-dialog" aria-label="Close catalog">×</button></div><p>Explore individual dilemmas in the clean interface. Your place in the continuous journey is saved.</p><div class="filter-group"><label for="family">Line of inquiry</label><select id="family"><option value="all">All twelve themes</option>${FAMILIES.map(f => `<option value="${f.id}" ${state.family === f.id ? 'selected' : ''}>${e(f.name)}</option>`).join('')}</select></div><div class="filter-group"><label for="tone">Level of absurdity</label><select id="tone">${TONES.map(t => `<option value="${t.id}" ${state.tone === t.id ? 'selected' : ''}>${e(t.label)}</option>`).join('')}</select></div><div class="dialog-actions"><button class="primary-button" id="start-explore">Generate a dilemma →</button><button class="secondary-button" id="continue-descent">Continue the journey</button></div><details><summary>Find a specific dilemma</summary><div class="filter-group"><label for="template">${ALL_TEMPLATES.length} authored templates</label><select id="template">${ALL_TEMPLATES.map(t => `<option value="${t.id}">${e(t.title)}</option>`).join('')}</select></div><button class="secondary-button" id="open-template">Open this dilemma</button></details>`;
  dialog.querySelector('.close-dialog').onclick = () => dialog.close();
  $('#start-explore').onclick = () => {
    const family = $('#family').value, tone = $('#tone').value;
    if (!eligibleTemplates({ family, tone }).length) { toast('No templates match that combination. Try a different tone.'); return; }
    state.tone = tone; dialog.close(); beginExploration(family);
  };
  $('#continue-descent').onclick = () => { syncPending(); state.mode = 'descent'; saveState(state); loadNext(); view = 'experiment'; dialog.close(); render(); };
  $('#open-template').onclick = () => { syncPending(); state.mode = 'explore'; saveState(state); loadNext({ templateId: $('#template').value }); view = 'experiment'; dialog.close(); render(); };
  openDialog(dialog);
}
function beginExploration(family) {
  syncPending(); state.family = family; state.mode = 'explore';
  if (!eligibleTemplates({ family, tone: state.tone }).length) state.tone = 'all';
  saveState(state); loadNext(); view = 'experiment'; render();
}
async function syncPending() {
  if(sending){resyncRequested=true;return;}
  if(!config.collectorUrl)return;
  sending=true;
  try{
    if(activeRun.sharing&&!activeRun.withdrawn&&!activeRun.registered){
      const registeringRun=activeRun;
      const result=await api(config,'/runs',{method:'POST',body:{runId:registeringRun.id,runToken:registeringRun.token,mode:registeringRun.mode,engineVersion:ENGINE_VERSION,noticeVersion:CONSENT_VERSION}});
      registeringRun.registered=true;registeringRun.number=result.runNumber;saveState(state);
    }
    for(const record of state.records.filter(r=>r.shareAllowed&&!r.shared)){
      const run=state.runs.find(r=>r.id===record.runId);
      if(!run?.sharing||run.withdrawn)continue;
      if(!run.registered){const result=await api(config,'/runs',{method:'POST',body:{runId:run.id,runToken:run.token,mode:run.mode,engineVersion:ENGINE_VERSION,noticeVersion:CONSENT_VERSION}});run.registered=true;run.number=result.runNumber;saveState(state);}
      const payload=publicPayload(record,run);
      await api(config,'/responses',{method:'POST',body:payload});
      record.shared=JSON.stringify(payload)===JSON.stringify(publicPayload(record,run));saveState(state);
    }
  }catch{toast('Live statistics are temporarily unavailable. Your run is saved here for retry.');}
  finally{sending=false;if(resyncRequested){resyncRequested=false;queueMicrotask(syncPending);}}
}

let audioContext;
function playSound() {
  if (!state.sound) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = 210 - currentChapter().stage * 18;
    gain.gain.setValueAtTime(.035, audioContext.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .24);
    oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + .25);
  } catch { /* Sound is optional and must never block a choice. */ }
}
document.addEventListener('click', event => {
  const button = event.target.closest('[data-view]'); if (!button || animating) return;
  if (!['experiment', 'record', 'guide'].includes(button.dataset.view)) return;
  pauseTimer(); syncPending(); view = button.dataset.view; render(); resumeTimer(); window.scrollTo({ top: 0, behavior: 'instant' });
});
$('.brand').onclick = event => { event.preventDefault(); if (animating) return; view = 'experiment'; render(); resumeTimer(); };
$('#preferences-button').onclick = openSettings; $('#privacy-button').onclick = openSettings;
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('close', resumeTimer);
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
});
document.addEventListener('keydown', event => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || $('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
  if (view !== 'experiment' || paused) return;
  if (event.key === 'Escape') { event.preventDefault(); stepOutside(); }
  if (event.key === '1' || event.key === '2' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') { const button = document.querySelectorAll('[data-choice]')[event.key==='ArrowLeft'?0:event.key==='ArrowRight'?1:Number(event.key)-1]; button?.click(); }
  if (event.key.toLowerCase() === 'n' && currentRecord) next();
});
try {
  current = fromUrl(location.href);
  if (current) { source = 'shared'; state.mode = 'explore'; }
  else loadNext();
} catch (error) { initialMessage = error.message; loadNext(); }
render();
if (!storageAvailable) toast('Browser storage is unavailable. You can still play and export this visit.');
try {
  config = validConfig(await (await fetch('./config.json')).json());
  if (config.repositoryUrl) { $('#source-link').href = config.repositoryUrl; $('#source-link').target = '_blank'; $('#source-link').rel = 'noopener noreferrer'; }
  if(!animating)render();
  syncPending();
} catch { /* A missing optional collector must not stop the static experience. */ }

// Progressive enhancement: the same visible actions are available to supported agents.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  for (const tool of [
    { name: 'read_trolley_dilemma', description: 'Read the current fictional dilemma and available outcomes.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ scenario: current, answered: !!currentRecord, paused }) },
    { name: 'answer_trolley_dilemma', description: 'Record a choice in the visible dilemma. Agent responses remain local and are marked as agent-generated.', inputSchema: { type: 'object', properties: { choice: { enum: ['pull', 'stay', 'skip'] } }, required: ['choice'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async input => { if (!['pull', 'stay', 'skip'].includes(input?.choice) || currentRecord || paused || view !== 'experiment') throw new Error('No available decision or invalid choice.'); choose(input.choice, true); await choiceFinished; return { responseId: currentRecord.responseId, choice: currentRecord.choice, shared: false }; } },
  ]) { try { await document.modelContext.registerTool(tool, { signal: lifecycle.signal }); } catch { /* Unsupported experimental API. */ } }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
