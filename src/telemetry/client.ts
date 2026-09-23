import { CONSENT_VERSION, type DecisionRecord } from "../contracts/index.ts";
import type { LocalRun } from "../persistence/index.ts";
import { saveRun, SaveConflictError } from "../persistence/index.ts";
import { availableAdvice } from "../simulation/index.ts";
import {
  EventPayload,
  EventBatch,
  RunRegistration,
  MAX_BATCH_EVENTS,
  MAX_BATCH_BYTES,
  MAX_QUEUE_EVENTS,
  QUEUE_TTL_MS,
  comparisonKeyFor,
  materialBase,
  stableStringify,
  type TelemetryEvent,
  type PresentationProfile,
} from "./protocol.ts";

interface LocalExposure {
  nodeId: string;
  revision: number;
  baseKey: string;
  presentations: PresentationProfile[];
  adviceIds: string[];
  decided: boolean;
}
interface State {
  kind: "telemetry-state";
  version: 2;
  nextSequence: number;
  startRevision: number;
  consentedAtStart: boolean;
  registrationAttempted: boolean;
  exposures: Record<string, LocalExposure>;
  stopped: boolean;
  saveConflictError: boolean;
  attempts: number;
  retryAt: number;
  lastError: string | null;
  ended: boolean;
}
interface Queued {
  kind: "telemetry-event";
  createdAt: number;
  event: TelemetryEvent;
}
const work = new Map<string, Promise<void>>(),
  controllers = new Map<string, AbortController>(),
  timers = new Map<string, ReturnType<typeof setTimeout>>();
const enabled = (run: LocalRun) =>
  run.sharing && !run.withdrawn && run.consentVersion === CONSENT_VERSION;
const isQueued = (entry: unknown): entry is Queued =>
  Boolean(
    entry &&
    typeof entry === "object" &&
    (entry as Queued).kind === "telemetry-event",
  );
function stateFor(run: LocalRun): State {
  let value = run.queue.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      (entry as State).kind === "telemetry-state",
  ) as State | undefined;
  if (!value) {
    value = {
      kind: "telemetry-state",
      version: 2,
      nextSequence: 0,
      startRevision: run.campaign.revision,
      consentedAtStart: enabled(run) && run.campaign.revision === 0,
      registrationAttempted: false,
      exposures: {},
      stopped: false,
      saveConflictError: false,
      attempts: 0,
      retryAt: 0,
      lastError: null,
      ended: false,
    };
    run.queue.unshift(value);
  }
  return value;
}
function profile(run: LocalRun): PresentationProfile {
  return { ...run.preferences };
}
function stop(run: LocalRun, state: State, message: string) {
  state.stopped = true;
  state.lastError = message;
  run.queue = run.queue.filter((entry) => !isQueued(entry));
}
function enqueue(run: LocalRun, payload: EventPayload): void {
  if (!enabled(run)) return;
  const state = stateFor(run);
  if (state.stopped) return;
  if (!state.consentedAtStart || state.startRevision !== 0) {
    stop(
      run,
      state,
      "This run began privately. Start a new opted-in run to share; no earlier choices were uploaded.",
    );
    return;
  }
  if (run.queue.filter(isQueued).length >= MAX_QUEUE_EVENTS) {
    stop(
      run,
      state,
      "The upload queue filled. This run continues locally; some observations were not shared.",
    );
    return;
  }
  const validated = EventPayload.parse(payload);
  run.queue.push({
    kind: "telemetry-event",
    createdAt: Date.now(),
    event: {
      eventId: crypto.randomUUID(),
      sequence: state.nextSequence++,
      payload: validated,
    },
  } satisfies Queued);
}
function expose(run: LocalRun, id: string, existing: LocalExposure): void {
  const current = profile(run),
    last = existing.presentations.at(-1);
  if (!last || stableStringify(last) !== stableStringify(current)) {
    existing.presentations.push(current);
    enqueue(run, {
      type: "node_exposed",
      decisionId: id,
      nodeId: existing.nodeId,
      revision: existing.revision,
      presentation: current,
    });
  }
}
/** Called only when an actual decision is visible; local bookkeeping is permitted during private play. */
export function recordExposure(run: LocalRun): void {
  const p = run.campaign.prepared;
  if (!p) return;
  const state = stateFor(run);
  const existing = (state.exposures[p.id] ??= {
    nodeId: p.nodeId,
    revision: p.revision,
    baseKey: materialBase(run.campaign, p),
    presentations: [],
    adviceIds: [],
    decided: false,
  });
  if (!existing.decided) expose(run, p.id, existing);
}
export function recordAdvice(run: LocalRun, id: string): void {
  const p = run.campaign.prepared;
  if (!p || !availableAdvice(p).some((reply) => reply.id === id)) return;
  recordExposure(run);
  const exposure = stateFor(run).exposures[p.id];
  if (!exposure || exposure.decided || exposure.adviceIds.includes(id)) return;
  exposure.adviceIds.push(id);
  enqueue(run, { type: "advice_exposed", decisionId: p.id, adviceId: id });
}
export function recordDecision(
  run: LocalRun,
  record: DecisionRecord,
  activeMs: number,
): void {
  const state = stateFor(run),
    exposure = state.exposures[record.id];
  if (!exposure) {
    if (enabled(run))
      stop(
        run,
        state,
        "A decision had no exposure record. The run continues locally; no invented exposure was uploaded.",
      );
    return;
  }
  if (exposure.decided) return;
  expose(run, record.id, exposure);
  if (
    stableStringify([...exposure.adviceIds].sort()) !==
    stableStringify([...new Set(record.adviceIds)].sort())
  ) {
    stop(
      run,
      state,
      "Advice exposure could not be reconciled. The run continues locally.",
    );
    return;
  }
  exposure.decided = true;
  enqueue(run, {
    type: "decision_committed",
    decisionId: record.id,
    requestedOptionId: record.requestedOptionId,
    revision: record.revision - 1,
    activeMs: Math.max(
      0,
      Math.min(
        86400000,
        Math.round((Number.isFinite(activeMs) ? activeMs : 0) / 100) * 100,
      ),
    ),
    adviceIds: [...exposure.adviceIds],
    source: "human",
  });
  if (run.campaign.ending && !state.ended) {
    state.ended = true;
    enqueue(run, {
      type: "run_ended",
      endingId: run.campaign.ending.id,
      revision: run.campaign.revision,
    });
  }
}
export function aggregateKeyFor(run: LocalRun, record: DecisionRecord): string {
  const exposure = stateFor(run).exposures[record.id];
  return exposure
    ? comparisonKeyFor(
        exposure.baseKey,
        exposure.adviceIds,
        exposure.presentations,
      )
    : "";
}
export function telemetryStatus(run: LocalRun) {
  const state = stateFor(run);
  return {
    pending: run.queue.filter(isQueued).length,
    stopped: state.stopped,
    saveConflictError: Boolean(state.saveConflictError),
    error: state.lastError,
  };
}
function baseURL(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("The collector requires HTTPS.");
  if (url.username || url.password || url.search || url.hash)
    throw new Error("Invalid collector address.");
  return value.replace(/\/$/, "");
}
async function request(
  url: string,
  path: string,
  body?: unknown,
  method = body ? "POST" : "GET",
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await fetch(baseURL(url) + path, {
    method,
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  let data: Record<string, unknown>;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new Error("Invalid collector response.");
  }
  if (!response.ok)
    throw Object.assign(
      new Error(
        typeof data.error === "string" ? data.error : "Collector unavailable.",
      ),
      { status: response.status },
    );
  return data;
}
async function persist(run: LocalRun, allowConflictForWithdrawal = false) {
  try {
    await saveRun(run);
  } catch (error) {
    if (error instanceof SaveConflictError) {
      const state = stateFor(run);
      run.sharing = false;
      state.saveConflictError = true;
      state.attempts = 0;
      state.retryAt = 0;
      stop(
        run,
        state,
        "Another tab saved this run. Sharing from this conflicting copy stopped. Reload the saved run or export this open copy.",
      );
      cancel(run);
      if (!allowConflictForWithdrawal) throw error;
    }
    // Ordinary unavailable-storage errors permit in-memory play. A save conflict
    // is different: it must never let this branch continue uploading.
  }
}
function cancel(run: LocalRun) {
  controllers.get(run.id)?.abort();
  const timer = timers.get(run.id);
  if (timer) clearTimeout(timer);
  timers.delete(run.id);
  run.queue = run.queue.filter((entry) => !isQueued(entry));
}

export async function syncRun(
  run: LocalRun,
  collectorUrl: string,
): Promise<void> {
  if (!enabled(run)) {
    cancel(run);
    return;
  }
  if (!collectorUrl) return;
  const active = work.get(run.id);
  if (active) return active;
  const job = (async () => {
    const state = stateFor(run);
    if (state.stopped || Date.now() < state.retryAt) return;
    if (!state.consentedAtStart || state.startRevision !== 0) {
      stop(
        run,
        state,
        "A private earlier history is not uploaded. Start a new run with sharing selected.",
      );
      await persist(run);
      return;
    }
    if (
      run.queue
        .filter(isQueued)
        .some((item) => Date.now() - item.createdAt > QUEUE_TTL_MS)
    ) {
      stop(
        run,
        state,
        "Queued observations expired after seven days. This run continues locally.",
      );
      await persist(run);
      return;
    }
    const controller = new AbortController();
    controllers.set(run.id, controller);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const send = async (path: string, body: unknown) => {
      // Registered runs also need the comparison before each batch, not merely
      // after upload. Detection stops the branch before another POST is sent.
      await persist(run);
      if (!enabled(run) || state.stopped)
        throw new Error("Sharing stopped before upload.");
      timeout = setTimeout(() => controller.abort(), 10000);
      try {
        return await request(
          collectorUrl,
          path,
          body,
          "POST",
          controller.signal,
        );
      } finally {
        clearTimeout(timeout);
      }
    };
    try {
      if (!run.runNumber) {
        const c = run.campaign;
        const body = RunRegistration.parse({
          runId: run.id,
          runToken: run.secret,
          started: true,
          consentVersion: run.consentVersion,
          manifest: {
            manifestId: c.manifestId,
            engineVersion: c.engineVersion,
            contentVersion: c.contentVersion,
            manifestHash: c.manifestHash,
            contentHash: c.contentHash,
            seed: c.seed,
          },
        });
        state.registrationAttempted = true;
        const registered = await send("/v2/runs", body);
        if (
          !Number.isSafeInteger(registered.runNumber) ||
          Number(registered.runNumber) < 1 ||
          registered.acceptedManifestHash !== c.manifestHash
        )
          throw new Error("Invalid registration receipt.");
        run.runNumber = Number(registered.runNumber);
        await persist(run);
      }
      while (enabled(run)) {
        const pending = run.queue
          .filter(isQueued)
          .sort((a, b) => a.event.sequence - b.event.sequence);
        if (!pending.length) break;
        const selected: Queued[] = [];
        for (const item of pending.slice(0, MAX_BATCH_EVENTS)) {
          const candidate = {
            runId: run.id,
            runToken: run.secret,
            events: [...selected, item].map((x) => x.event),
          };
          if (
            new TextEncoder().encode(JSON.stringify(candidate)).byteLength >
            MAX_BATCH_BYTES
          )
            break;
          selected.push(item);
        }
        if (!selected.length) {
          stop(
            run,
            state,
            "An upload exceeded the event size limit. The run continues locally.",
          );
          break;
        }
        const body = EventBatch.parse({
          runId: run.id,
          runToken: run.secret,
          events: selected.map((item) => item.event),
        });
        const receipt = await send("/v2/events", body);
        if (
          !Array.isArray(receipt.accepted) ||
          !selected.every((item) =>
            (receipt.accepted as unknown[]).includes(item.event.eventId),
          )
        )
          throw new Error("Incomplete event acknowledgement.");
        const ids = new Set(selected.map((item) => item.event.eventId));
        run.queue = run.queue.filter(
          (item) => !isQueued(item) || !ids.has(item.event.eventId),
        );
        state.attempts = 0;
        state.retryAt = 0;
        state.lastError = null;
        await persist(run);
      }
    } catch (error) {
      if (error instanceof SaveConflictError) throw error;
      if (enabled(run) && !state.stopped) {
        const status = (error as { status?: number }).status;
        if (status && [400, 403, 409, 410, 413].includes(status))
          stop(
            run,
            state,
            "The collector rejected this run’s event sequence or release. Play continues locally; earlier accepted records can still be withdrawn.",
          );
        else {
          state.attempts++;
          const delay =
            Math.min(3600000, 1000 * 2 ** Math.min(state.attempts, 11)) +
            Math.floor(Math.random() * 1000);
          state.retryAt = Date.now() + delay;
          state.lastError =
            "Sharing is temporarily unavailable. The saved queue will retry.";
          const previous = timers.get(run.id);
          if (previous) clearTimeout(previous);
          timers.set(
            run.id,
            setTimeout(() => {
              timers.delete(run.id);
              void syncRun(run, collectorUrl).catch((error) => {
                // Background retries have no caller to receive a rejected promise. The
                // conflict remains visible through telemetryStatus and cannot reschedule.
                if (!(error instanceof SaveConflictError)) {
                  run.sharing = false;
                  stop(
                    run,
                    state,
                    "Sharing stopped after a local save error. The open run can still be exported.",
                  );
                  cancel(run);
                }
              });
            }, delay),
          );
        }
      }
    } finally {
      if (timeout) clearTimeout(timeout);
      controllers.delete(run.id);
      if (!enabled(run)) cancel(run);
      if (!state.saveConflictError) await persist(run);
    }
  })();
  work.set(run.id, job);
  try {
    await job;
  } finally {
    work.delete(run.id);
  }
}
export async function withdrawRun(run: LocalRun, url: string): Promise<void> {
  run.sharing = false;
  cancel(run);
  await persist(run, true);
  if (!url && (run.runNumber !== null || stateFor(run).registrationAttempted))
    throw new Error(
      "Sharing stopped locally. The collector address is needed to confirm remote withdrawal.",
    );
  // Registration might have reached the service even if its response was lost.
  // Always try deletion when a configured collector exists.
  if (url) {
    const result = await request(
      url,
      `/v2/runs/${encodeURIComponent(run.id)}`,
      { runId: run.id, runToken: run.secret },
      "DELETE",
      AbortSignal.timeout(10000),
    );
    if (result.withdrawn !== true)
      throw new Error("Withdrawal was not confirmed.");
  }
  run.withdrawn = true;
  await persist(run, true);
  const state = stateFor(run);
  state.lastError = state.saveConflictError
    ? "Remote withdrawal was confirmed. This conflicting copy could not replace the local save."
    : null;
}
export interface AggregateResult {
  available: boolean;
  status: "available" | "suppressed" | "unavailable";
  n?: number;
  counts?: Record<string, number>;
  asOf?: string;
}
export async function readAggregate(
  url: string,
  comparisonKey: string,
): Promise<AggregateResult> {
  if (!url || !comparisonKey)
    return { available: false, status: "unavailable" };
  try {
    const data = await request(
      url,
      `/v2/aggregates?key=${encodeURIComponent(comparisonKey)}`,
      undefined,
      "GET",
      AbortSignal.timeout(10000),
    );
    if (
      data.schemaVersion === 2 &&
      data.available === false &&
      data.status === "insufficient"
    )
      return { available: false, status: "suppressed" };
    if (
      data.available !== true ||
      data.schemaVersion !== 2 ||
      data.comparisonKey !== comparisonKey ||
      !Number.isSafeInteger(data.n) ||
      Number(data.n) < 20 ||
      typeof data.asOf !== "string" ||
      !Number.isFinite(Date.parse(data.asOf)) ||
      !data.counts ||
      typeof data.counts !== "object" ||
      Array.isArray(data.counts)
    )
      return { available: false, status: "unavailable" };
    const counts = data.counts as Record<string, number>;
    if (
      !Object.values(counts).every((n) => Number.isSafeInteger(n) && n >= 0) ||
      Object.values(counts).reduce((a, b) => a + b, 0) !== data.n
    )
      return { available: false, status: "unavailable" };
    return {
      available: true,
      status: "available",
      n: Number(data.n),
      counts,
      asOf: data.asOf,
    };
  } catch {
    return { available: false, status: "unavailable" };
  }
}
