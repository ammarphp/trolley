import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import {
  newSession,
  saveRun,
  listRuns,
  removeLocalRun,
  publicExport,
  SaveConflictError,
  type LocalRun,
} from "../../src/persistence/index.ts";
import { createCampaign, commitChoice } from "../../src/simulation/index.ts";
import { SLICE_MANIFEST, SLICE_NODES } from "../../src/content/slice.ts";

const preferences = {
  reducedMotion: false,
  reducedGraphics: false,
  audio: false,
  descriptions: false,
};
async function fresh() {
  globalThis.indexedDB = new IDBFactory();
  return newSession(
    await createCampaign(SLICE_MANIFEST, SLICE_NODES, "persistence-fixture"),
    preferences,
  );
}
async function advance(run: LocalRun, alternate = false) {
  const prepared = run.campaign.prepared!;
  run.campaign = await commitChoice(
    run.campaign,
    {
      decisionId: prepared.id,
      expectedRevision: run.campaign.revision,
      optionId: prepared.node.options[alternate ? 1 : 0].id,
      actor: "human",
    },
    SLICE_NODES,
  );
}

test("atomic compare-and-save protects a committed branch from a stale tab", async () => {
  const run = await fresh();
  await saveRun(run);
  const stale = structuredClone(run);
  await advance(run);
  await saveRun(run);
  await advance(stale, true);
  await assert.rejects(saveRun(stale), SaveConflictError);
  const [stored] = await listRuns();
  assert.deepEqual(stored.campaign, run.campaign);
  assert.equal(stored.savedRevision, 1);
  assert.equal(stored.saveVersion, 2);
  assert.equal(
    stale.saveVersion,
    1,
    "conflict must not pretend the losing branch was saved",
  );
});

test("same-revision queue and preference updates cannot be overwritten by a stale copy", async () => {
  const run = await fresh();
  await saveRun(run);
  const stale = structuredClone(run);
  run.queue = [{ event: "accepted" }];
  run.preferences.audio = true;
  await saveRun(run);
  stale.queue = [{ event: "old retry" }];
  await assert.rejects(saveRun(stale), SaveConflictError);
  const [stored] = await listRuns();
  assert.deepEqual(stored.queue, [{ event: "accepted" }]);
  assert.equal(stored.preferences.audio, true);
  assert.equal(stored.campaign.revision, 0);
});

test("competing transactions with the same expected version have one winner", async () => {
  const run = await fresh();
  await saveRun(run);
  const other = structuredClone(run);
  run.preferences.audio = true;
  other.preferences.reducedMotion = true;
  const writes = await Promise.allSettled([saveRun(run), saveRun(other)]);
  assert.equal(writes.filter((w) => w.status === "fulfilled").length, 1);
  const rejected = writes.find(
    (w) => w.status === "rejected",
  ) as PromiseRejectedResult;
  assert.ok(rejected.reason instanceof SaveConflictError);
  assert.equal((await listRuns())[0].saveVersion, 2);
});

test("same live object serializes invocation snapshots and permits repeated saves", async () => {
  const run = await fresh();
  const initial = saveRun(run);
  run.queue.push({ event: "second write" });
  const second = saveRun(run);
  await Promise.all([initial, second]);
  assert.equal(run.saveVersion, 2);
  assert.deepEqual((await listRuns())[0].queue, run.queue);
  await saveRun(run);
  assert.equal(run.saveVersion, 3);
  await advance(run);
  const committed = saveRun(run);
  run.preferences.descriptions = true;
  const metadata = saveRun(run);
  await Promise.all([committed, metadata]);
  const [stored] = await listRuns();
  assert.equal(stored.savedRevision, 1);
  assert.equal(stored.preferences.descriptions, true);
  assert.equal(stored.saveVersion, 5);
});

test("failed puts leave stored data and local version unchanged; a retry can succeed", async () => {
  const run = await fresh();
  await saveRun(run);
  const before = structuredClone(run);
  const original = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function () {
    throw new DOMException(
      "Injected storage quota failure",
      "QuotaExceededError",
    );
  };
  run.preferences.audio = true;
  try {
    await assert.rejects(saveRun(run), { name: "QuotaExceededError" });
  } finally {
    IDBObjectStore.prototype.put = original;
  }
  assert.equal(run.saveVersion, 1);
  assert.deepEqual((await listRuns())[0], before);
  await saveRun(run);
  assert.equal(run.saveVersion, 2);
  assert.equal((await listRuns())[0].preferences.audio, true);
});

test("deleted runs and changed same-revision campaigns cannot be resurrected or silently rewritten", async () => {
  const run = await fresh();
  await saveRun(run);
  const edited = structuredClone(run);
  edited.campaign.world.gdp++;
  await assert.rejects(saveRun(edited), SaveConflictError);
  await removeLocalRun(run.id);
  await assert.rejects(saveRun(run), SaveConflictError);
  assert.deepEqual(await listRuns(), []);
});

test("pre-CAS saves normalize safely and local metadata stays out of exports", async () => {
  const run = await fresh();
  await advance(run);
  const legacy = structuredClone(run) as Partial<LocalRun>;
  delete legacy.savedRevision;
  delete legacy.saveVersion;
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("trolley-v2", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("runs", { keyPath: "id" });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction("runs", "readwrite");
      tx.objectStore("runs").put(legacy);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
  const [loaded] = await listRuns();
  assert.equal(loaded.savedRevision, 1);
  assert.equal(loaded.saveVersion, 0);
  loaded.preferences.audio = true;
  await saveRun(loaded);
  assert.equal((await listRuns())[0].saveVersion, 1);
  const exported = publicExport(loaded);
  for (const key of ["secret", "queue", "saveVersion", "savedRevision"])
    assert.equal(key in exported, false);
});
