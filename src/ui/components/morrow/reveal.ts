/**
 * The reveal plan: a pure, DOM-free schedule for one reply.
 *
 *   thinking → [draft → erase →] writing → done
 *
 * Each step says how long to wait after the previous step and what should be
 * visible once it applies. The window walks the steps with timers; finishing
 * early jumps to the last step. Timing jitter is seeded from the exchange id,
 * so a replay reads at the same cadence.
 */
import { hashId, type MorrowTone } from "./copy.ts";

export type RevealPhase = "thinking" | "draft" | "erase" | "writing" | "done";

export interface RevealStep {
  /** Milliseconds to wait after the previous step. Step 0 applies at once. */
  delay: number;
  phase: RevealPhase;
  /** Characters of the withdrawn draft visible (draft/erase phases). */
  draftChars: number;
  /** Words of the real answer visible. */
  words: number;
}

export interface RevealPlan {
  id: string;
  answer: string;
  words: string[];
  draft: string | null;
  steps: RevealStep[];
  /** Sum of all delays, i.e. the unassisted duration. */
  totalMs: number;
}

export interface RevealInput {
  id: string;
  answer: string;
  tone: MorrowTone;
  /** A withdrawn draft to stream and delete before the real answer. */
  draft?: string | null;
}

/** Word chunks that keep their trailing whitespace (including paragraph breaks). */
export function splitWords(text: string): string[] {
  return text.match(/\S+\s*/g) ?? (text ? [text] : []);
}

/** A tiny deterministic generator (mulberry32) for cadence only. */
function cadence(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const THINK_MS: Record<MorrowTone, number> = {
  candid: 760,
  narrow: 560,
  coercive: 220,
};
/** At most this many writing steps, however long the answer is. */
export const MAX_WRITE_STEPS = 60;
const WRITE_MS = 40;
const DRAFT_WORD_MS = 78;
const DRAFT_HOLD_MS = 1150;
const ERASE_STEPS = 16;
const ERASE_MS = 24;
const AFTER_ERASE_MS = 420;

export function planReveal(input: RevealInput): RevealPlan {
  const words = splitWords(input.answer);
  const draft = input.draft ? input.draft : null;
  const rand = cadence(hashId(`reveal:${input.id}`));
  const steps: RevealStep[] = [
    { delay: 0, phase: "thinking", draftChars: 0, words: 0 },
  ];
  const think =
    THINK_MS[input.tone] + Math.round(rand() * (input.tone === "coercive" ? 60 : 240));
  let firstDelay = think;

  if (draft) {
    // Stream the draft word by word, hold, then delete it in view.
    const draftWords = splitWords(draft);
    let chars = 0;
    for (const word of draftWords) {
      chars += word.length;
      steps.push({
        delay: firstDelay || Math.round(DRAFT_WORD_MS * (0.7 + rand() * 0.6)),
        phase: "draft",
        draftChars: chars,
        words: 0,
      });
      firstDelay = 0;
    }
    const length = draft.length;
    const bite = Math.max(1, Math.ceil(length / ERASE_STEPS));
    let left = length;
    let hold = DRAFT_HOLD_MS;
    while (left > 0) {
      left = Math.max(0, left - bite);
      steps.push({
        delay: hold || Math.round(ERASE_MS * (0.75 + rand() * 0.5)),
        phase: "erase",
        draftChars: left,
        words: 0,
      });
      hold = 0;
    }
    firstDelay = AFTER_ERASE_MS;
  }

  const chunk = Math.max(1, Math.ceil(words.length / MAX_WRITE_STEPS));
  let shown = 0;
  while (shown < words.length) {
    shown = Math.min(words.length, shown + chunk);
    steps.push({
      delay: firstDelay || Math.round(WRITE_MS * (0.65 + rand() * 0.7)),
      phase: shown === words.length ? "done" : "writing",
      draftChars: 0,
      words: shown,
    });
    firstDelay = 0;
  }
  if (!words.length)
    steps.push({ delay: firstDelay || WRITE_MS, phase: "done", draftChars: 0, words: 0 });

  return {
    id: input.id,
    answer: input.answer,
    words,
    draft,
    steps,
    totalMs: steps.reduce((sum, step) => sum + step.delay, 0),
  };
}

/** The text a step shows in the reply body. */
export function stepText(plan: RevealPlan, step: RevealStep): string {
  if (step.phase === "done") return plan.answer;
  if (step.phase === "draft" || step.phase === "erase")
    return (plan.draft ?? "").slice(0, step.draftChars);
  return plan.words.slice(0, step.words).join("");
}

/** Paragraphs as the body shows them: split on blank lines, trailing gaps dropped. */
export function toParagraphs(text: string): string[] {
  const parts = text.split(/\n\n+/).map((part) => part.replace(/\s+$/, ""));
  while (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();
  return parts;
}
