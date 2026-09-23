import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const inventory = await read('research/content/candidate-inventory.json');
const proposal = await read('research/proposals/philosophy.json');
const fixtureSpec = await read('research/fixtures-spec.json');
const expectedStageCounts = [12, 18, 24, 28, 28, 24, 20];
const nonblank = value => typeof value === 'string' && value.trim().length > 0;
const normalized = value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function validateSources(doc) {
  assert.equal(doc.status, 'proposal_not_merged');
  assert.equal(doc.review, 'author_self_review_only');
  const ids = new Set();
  for (const source of doc.sources) {
    assert(!ids.has(source.id), `Duplicate source ${source.id}`);
    ids.add(source.id);
    assert(nonblank(source.title) && source.authors.length > 0);
    assert.equal(new URL(source.url).protocol, 'https:');
    assert.equal(source.reading.status, 'selected_sections');
    assert(source.reading.locators.length > 0 && source.reading.locators.every(nonblank));
    assert(nonblank(source.reading.scope));
    assert(source.limits.length > 0 && source.limits.every(nonblank));
    assert(['philosophical_argument', 'empirical'].includes(source.evidenceType));
  }
  const claimIds = new Set();
  for (const claim of doc.claims) {
    assert(!claimIds.has(claim.id), `Duplicate claim ${claim.id}`);
    claimIds.add(claim.id);
    assert.equal(claim.status, 'proposal');
    assert(claim.sourceIds.length > 0 && claim.sourceIds.every(id => ids.has(id)), `Unknown claim source ${claim.id}`);
    assert(nonblank(claim.statement) && nonblank(claim.approvedUse) && nonblank(claim.inGameNumbers));
  }
  return ids;
}

function validateInventory(doc, sources) {
  assert.equal(doc.status, 'draft_candidate_inventory');
  assert.equal(doc.productionApprovedCount, 0);
  assert.equal(doc.nodes.length, 154);
  assert.deepEqual(doc.stageCounts.map(row => row.count), expectedStageCounts);
  const ids = new Set(), distinctions = new Set();
  for (const node of doc.nodes) {
    assert(!ids.has(node.id), `Duplicate candidate ${node.id}`);
    ids.add(node.id);
    assert(Number.isInteger(node.stage) && node.stage >= 1 && node.stage <= 7);
    assert.match(node.id, new RegExp(`^S${node.stage}-[0-9]{2}$`));
    assert(nonblank(node.title) && nonblank(node.role));
    assert(nonblank(node.primaryDistinction));
    const distinction = normalized(node.primaryDistinction);
    assert(!distinctions.has(distinction), `Duplicate distinction ${node.id}`);
    distinctions.add(distinction);
    assert.equal(node.status, 'proposed');
    assert.equal(node.productionEligible, false);
    assert.deepEqual(node.options.map(option => option.id), ['a', 'b']);
    assert(node.options.every(option => nonblank(option.draftAction)));
    assert.notEqual(normalized(node.options[0].draftAction), normalized(node.options[1].draftAction));
    assert.equal(node.provenance.reviewStatus, 'not_reviewed');
    assert(node.provenance.sourceIds.every(id => sources.has(id)), `Unknown candidate source ${node.id}`);
    assert.equal(node.provenance.readingStatus, node.provenance.sourceIds.length ? 'selected_sections_only' : 'mechanism_dossier_pending');
    assert(nonblank(node.provenance.numberPolicy));
    assert(node.reviewNeeds.length >= 2 && node.reviewNeeds.every(nonblank));
  }
  for (const [stageIndex, count] of expectedStageCounts.entries()) {
    const stage = stageIndex + 1;
    const actual = doc.nodes.filter(node => node.stage === stage).map(node => node.id).sort();
    const expected = Array.from({ length: count }, (_, i) => `S${stage}-${String(i + 1).padStart(2, '0')}`);
    assert.deepEqual(actual, expected, `Incorrect stage ${stage} inventory`);
  }
  for (const node of doc.nodes) {
    for (const dependency of node.prerequisiteCandidates) {
      assert(ids.has(dependency), `Unknown callback prerequisite ${dependency}`);
      assert.notEqual(dependency, node.id, `Self prerequisite ${node.id}`);
      const prior = doc.nodes.find(other => other.id === dependency);
      assert(prior.stage <= node.stage, `Callback setup occurs after ${node.id}`);
    }
  }
  return ids;
}

function validateFixtures(doc, candidates) {
  assert.equal(doc.status, 'draft_semantic_fixture_specification');
  assert.equal(doc.fixtures.length, 16);
  const ids = new Set(), coverage = new Set();
  for (const fixture of doc.fixtures) {
    assert(!ids.has(fixture.id), `Duplicate fixture ${fixture.id}`);
    ids.add(fixture.id);
    assert.equal(fixture.status, 'specification_not_runtime_test');
    assert(fixture.candidateIds.length > 0 && fixture.candidateIds.every(id => candidates.has(id)));
    assert(fixture.setup.facts.length > 0 && fixture.setup.facts.every(nonblank));
    assert.deepEqual(fixture.options.map(option => option.id), ['a', 'b']);
    for (const option of fixture.options) {
      assert(nonblank(option.label));
      assert(option.immediateAssertions.length > 0 && option.immediateAssertions.every(nonblank));
      assert(option.delayedAssertions.length > 0 && option.delayedAssertions.every(nonblank));
    }
    assert(fixture.invariants.length >= 2 && fixture.invariants.every(nonblank));
    assert(fixture.adversarialCases.length >= 2 && fixture.adversarialCases.every(nonblank));
    assert(nonblank(fixture.evidenceBoundary));
    fixture.coverage.forEach(tag => coverage.add(tag));
  }
  for (const requirement of ['certainty', 'uncertainty', 'keyed-rng', 'replay', 'delayed-event', 'observation', 'report-corruption', 'authority', 'expiry', 'revocation', 'forced-action', 'statistics-exclusion', 'fallback', 'benefit', 'rollback', 'evaluation', 'common-cause', 'positive-witness', 'near-miss', 'extinction']) {
    assert(coverage.has(requirement), `Missing semantic coverage ${requirement}`);
  }
}

test('154 draft candidates retain approved stage allocation, IDs, contrasts and valid callback references', () => {
  validateInventory(inventory, validateSources(proposal));
});

test('philosophy source proposals retain inspected scopes, locators, limits and linked claims', () => {
  const ids = validateSources(proposal);
  assert(ids.has('PHIL-FOOT-1967') && ids.has('PHIL-THOMSON-1985'));
  assert(ids.has('PHIL-MORAL-MACHINE-2018') && ids.has('PHIL-CLASSIC-2020'));
  assert(ids.has('PHIL-NYHOLM-SMIDS-2016'));
});

test('sixteen language-neutral fixture specifications cover both options and adversarial obligations', () => {
  validateFixtures(fixtureSpec, validateInventory(inventory, validateSources(proposal)));
});

test('inventory checks reject duplicate IDs, repeated distinctions and false production promotion', () => {
  const sources = validateSources(proposal);
  for (const tamper of [
    doc => { doc.nodes[1].id = doc.nodes[0].id; },
    doc => { doc.nodes[1].primaryDistinction = doc.nodes[0].primaryDistinction; },
    doc => { doc.nodes[0].productionEligible = true; },
    doc => { doc.nodes.pop(); },
    doc => { doc.nodes[0].prerequisiteCandidates = ['S9-99']; },
    doc => { doc.nodes[0].provenance.sourceIds = ['UNREAD-INVENTED-SOURCE']; },
  ]) {
    const changed = structuredClone(inventory); tamper(changed);
    assert.throws(() => validateInventory(changed, sources));
  }
});

test('source checks reject empty reading evidence and unsupported claim references', () => {
  for (const tamper of [
    doc => { doc.sources[0].reading.locators = []; },
    doc => { doc.sources[0].reading.status = 'full_book_read'; },
    doc => { doc.sources[0].limits = []; },
    doc => { doc.claims[0].sourceIds = ['UNKNOWN']; },
  ]) {
    const changed = structuredClone(proposal); tamper(changed);
    assert.throws(() => validateSources(changed));
  }
});

test('fixture checks reject missing alternatives, unknown candidates and claims of runtime passage', () => {
  const candidates = new Set(inventory.nodes.map(node => node.id));
  for (const tamper of [
    doc => { doc.fixtures[0].options.pop(); },
    doc => { doc.fixtures[0].candidateIds = ['S8-01']; },
    doc => { doc.fixtures[0].status = 'runtime_passed'; },
    doc => { doc.fixtures[0].adversarialCases = []; },
  ]) {
    const changed = structuredClone(fixtureSpec); tamper(changed);
    assert.throws(() => validateFixtures(changed, candidates));
  }
});
