import type { Campaign } from "../contracts/index.ts";
export interface Preferences {
  reducedMotion: boolean;
  reducedGraphics: boolean;
  audio: boolean;
  descriptions: boolean;
}
export interface LocalRun {
  schemaVersion: 2;
  id: string;
  secret: string;
  runNumber: number | null;
  sharing: boolean;
  withdrawn: boolean;
  consentVersion: string | null;
  campaign: Campaign;
  preferences: Preferences;
  adviceIds: string[];
  completed: boolean;
  savedAt: number;
  savedRevision: number;
  saveVersion: number;
  queue: unknown[];
}
const DB_NAME = "trolley-v2";
const STORE = "runs";
const saves = new WeakMap<LocalRun, Promise<void>>();

/** A stale tab must export/resume rather than overwrite another tab's saved branch. */
export class SaveConflictError extends Error {
  readonly code = "SAVE_CONFLICT";
  constructor(
    message = "This run was saved by another tab. Resume the saved run or export this unsaved branch.",
  ) {
    super(message);
    this.name = "SaveConflictError";
  }
}

function localCounter(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0)
    throw new Error(`Invalid ${label}.`);
  return Number(value);
}
function normalizeStored(run: LocalRun): LocalRun {
  const savedRevision = localCounter(
    run.campaign.revision,
    "saved campaign revision",
  );
  const saveVersion =
    run.saveVersion === undefined
      ? 0
      : localCounter(run.saveVersion, "local save version");
  if (run.savedRevision !== undefined && run.savedRevision !== savedRevision)
    throw new Error("Saved revision metadata is inconsistent.");
  return { ...run, savedRevision, saveVersion };
}
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("Browser storage is unavailable."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () =>
      reject(new Error("Close the other trolley tab to update storage."));
  });
}
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    let value: T;
    const req = action(tx.objectStore(STORE));
    req.onsuccess = () => {
      value = req.result;
    };
    req.onerror = () => tx.abort();
    tx.oncomplete = () => {
      db.close();
      resolve(value);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(tx.error || req.error || new Error("Save transaction failed."));
    };
  });
}
async function compareAndSave(
  snapshot: LocalRun,
  expectedRevision: number,
  expectedVersion: number,
): Promise<LocalRun> {
  localCounter(expectedRevision, "expected saved revision");
  localCounter(expectedVersion, "expected local save version");
  localCounter(snapshot.campaign.revision, "campaign revision");
  if (snapshot.campaign.revision < expectedRevision)
    throw new SaveConflictError(
      "An older campaign revision cannot replace the saved run.",
    );
  if (expectedVersion === Number.MAX_SAFE_INTEGER)
    throw new Error("Local save version limit reached. Export this run.");
  const db = await open();
  return new Promise((resolve, reject) => {
    // IndexedDB serializes readwrite transactions over this store. Read and put must
    // remain in this one transaction; checking before opening it would race.
    const tx = db.transaction(STORE, "readwrite"),
      store = tx.objectStore(STORE);
    let failure: unknown, installed: LocalRun;
    const get = store.get(snapshot.id);
    get.onsuccess = () => {
      try {
        const current = get.result
          ? normalizeStored(get.result as LocalRun)
          : undefined;
        if (!current) {
          if (expectedVersion !== 0 || expectedRevision !== 0)
            throw new SaveConflictError(
              "This saved run was removed. It will not be recreated by a stale tab.",
            );
        } else {
          if (
            current.saveVersion !== expectedVersion ||
            current.savedRevision !== expectedRevision ||
            current.secret !== snapshot.secret
          )
            throw new SaveConflictError();
          if (current.withdrawn && !snapshot.withdrawn)
            throw new SaveConflictError(
              "A stale save cannot undo a confirmed withdrawal.",
            );
          if (snapshot.campaign.revision === expectedRevision) {
            if (
              JSON.stringify(snapshot.campaign) !==
              JSON.stringify(current.campaign)
            )
              throw new SaveConflictError(
                "The campaign changed without a new committed revision.",
              );
          } else {
            const prior = current.campaign,
              next = snapshot.campaign;
            if (
              prior.seed !== next.seed ||
              prior.manifestHash !== next.manifestHash ||
              prior.contentHash !== next.contentHash ||
              JSON.stringify(next.journal.slice(0, prior.journal.length)) !==
                JSON.stringify(prior.journal)
            ) {
              throw new SaveConflictError(
                "A different campaign branch cannot replace the saved run.",
              );
            }
          }
        }
        installed = {
          ...snapshot,
          savedRevision: snapshot.campaign.revision,
          saveVersion: expectedVersion + 1,
          savedAt: Date.now(),
        };
        store.put(installed);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    get.onerror = () => {
      failure = get.error;
    };
    tx.oncomplete = () => {
      db.close();
      resolve(installed);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(failure || tx.error || new Error("Save transaction failed."));
    };
  });
}

export async function saveRun(run: LocalRun): Promise<void> {
  // Freeze this invocation's content. Later edits to the live object must not
  // change an already requested write while IndexedDB is opening/locked.
  const snapshot = structuredClone(run);
  const previous = saves.get(run) || Promise.resolve();
  const save = previous
    .catch(() => {})
    .then(async () => {
      // Only this same live object may inherit metadata from its preceding save.
      // Other tabs/copies retain their stale version and fail the atomic comparison.
      const installed = await compareAndSave(
        snapshot,
        run.savedRevision,
        run.saveVersion,
      );
      run.savedRevision = installed.savedRevision;
      run.saveVersion = installed.saveVersion;
      run.savedAt = installed.savedAt;
    });
  saves.set(run, save);
  const clear = () => {
    if (saves.get(run) === save) saves.delete(run);
  };
  void save.then(clear, clear);
  return save;
}
export async function listRuns(): Promise<LocalRun[]> {
  const rows = (await transaction("readonly", (s) => s.getAll())) as LocalRun[];
  return rows
    .filter((r) => r.schemaVersion === 2 && r.campaign?.schemaVersion === 2)
    .map(normalizeStored)
    .sort((a, b) => b.savedAt - a.savedAt);
}
export async function removeLocalRun(id: string): Promise<void> {
  await transaction("readwrite", (s) => s.delete(id));
}
export function newSession(
  campaign: Campaign,
  preferences: Preferences,
  sharing = false,
): LocalRun {
  return {
    schemaVersion: 2,
    id: crypto.randomUUID(),
    secret: crypto.randomUUID() + crypto.randomUUID(),
    runNumber: null,
    sharing,
    withdrawn: false,
    consentVersion: sharing ? "run-opt-in-2" : null,
    campaign,
    preferences: { ...preferences },
    adviceIds: [],
    completed: false,
    savedAt: Date.now(),
    savedRevision: 0,
    saveVersion: 0,
    queue: [],
  };
}
export function safeDownload(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function publicExport(run: LocalRun) {
  const { secret, queue, savedRevision, saveVersion, ...safe } = run;
  return {
    ...safe,
    notice:
      "Fictional simulation. This file contains one run, not an identity or moral assessment. The withdrawal secret is deliberately excluded.",
  };
}
