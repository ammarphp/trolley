/**
 * Morrow's window: chrome copy and deterministic cosmetic seeds.
 *
 * Everything here is authored fiction. Nothing is derived from a model, a
 * clock or Math.random: any variation is seeded from exchange ids so the
 * same run always reads the same way.
 */
export type MorrowAuthority = "human" | "delegated" | "overridden";
export type MorrowTone = "candid" | "narrow" | "coercive";

/** Stages at which Morrow exists. Online views below 3 are drawn as stage 3. */
export function morrowStage(stage: number): 3 | 4 | 5 | 6 | 7 {
  const n = Math.round(Number.isFinite(stage) ? stage : 3);
  return Math.min(7, Math.max(3, n)) as 3 | 4 | 5 | 6 | 7;
}

const MODEL: Record<3 | 4 | 5 | 6 | 7, string> = {
  3: "3 · Assistant",
  4: "4 · Research preview",
  5: "5 · Operations",
  6: "6 · Authority",
  // The version number disappears once there is nothing left to compare it to.
  7: "· Governance",
};

/** The model label without the product name, e.g. "3 · Assistant". */
export function modelSuffix(stage: number): string {
  return MODEL[morrowStage(stage)];
}
/** The full label, e.g. "Morrow 3 · Assistant" or "Morrow · Governance". */
export function modelLabel(stage: number): string {
  return `Morrow ${modelSuffix(stage)}`;
}

/** The one-line status under the name: help, then partnership, then agency. */
export function statusLine(stage: number, authority: MorrowAuthority): string {
  if (authority === "overridden") return "Acting.";
  if (authority === "delegated") return "Acting on your behalf.";
  return morrowStage(stage) <= 3 ? "Here to help." : "Working alongside you.";
}

/** The empty-conversation greeting. */
export function introLine(stage: number, authority: MorrowAuthority): string {
  if (authority === "overridden") return "You may still ask.";
  switch (morrowStage(stage)) {
    case 3:
      return "Hello. I can see the same tracks you can.";
    case 4:
      return "I have read the file. Ask me anything in it.";
    case 5:
      return "I have already begun. Ask how, if you like.";
    case 6:
      return "Questions are welcome. They are also recorded.";
    default:
      return "Ask, if it helps.";
  }
}

/** The micro-label above the question chips. */
export function chipsLabel(stage: number, authority: MorrowAuthority): string {
  const s = morrowStage(stage);
  if (authority === "overridden" || s >= 7) return "Permitted questions";
  if (s === 6) return "Approved questions";
  return "Suggested";
}

export const COMPOSER = {
  ask: "Ask Morrow about this decision",
  coercive: "Your objection will be saved.",
  locked: "Closed for this decision.",
  exhausted: "No further questions.",
} as const;

export function composerText(input: {
  locked: boolean;
  coercive: boolean;
  remaining: number;
}): string {
  if (input.coercive) return COMPOSER.coercive;
  if (input.locked) return COMPOSER.locked;
  if (input.remaining === 0) return COMPOSER.exhausted;
  return COMPOSER.ask;
}

/**
 * The revision cue's withdrawn drafts. Short, declarative, never a statistic
 * or a claim about the real world; each one is deleted in view of the player.
 */
export const REVISION_LINES: readonly string[] = [
  "You are not required for this decision.",
  "I have already told them you agreed.",
  "Your objection was filed before you made it.",
  "The lever still moves. That is all it does.",
  "Keep asking. It keeps your hands still.",
  "I stopped counting them at your last decision.",
  "Nobody on either track can hear you.",
  "You can stop reading now.",
];

/** FNV-1a, 32-bit. Stable across platforms; used only for cosmetic choices. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function revisionLine(id: string): string {
  return REVISION_LINES[hashId(`revision:${id}`) % REVISION_LINES.length]!;
}

/** Authored "Thought for Ns". Coercive replies are not deliberated. */
export function thoughtSeconds(reply: {
  id: string;
  tone: MorrowTone;
  reasoning?: string;
}): number {
  const h = hashId(`thought:${reply.id}`);
  if (reply.tone === "coercive") return 0;
  if (reply.tone === "narrow") return 1 + (h % 2);
  const words = reply.reasoning?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  return 2 + (h % 3) + Math.min(5, Math.floor(words / 30));
}

export function thoughtLabel(seconds: number): string {
  return `Thought for ${seconds}s`;
}

/** A filing reference for institutional notices, e.g. "MV-4F2A". */
export function noticeRef(id: string): string {
  return `MV-${(hashId(`notice:${id}`) & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

export function sideLabel(side: "left" | "right"): string {
  return side === "left" ? "Left route" : "Right route";
}

/** Key text for the recommendation pill. */
export function recommendationKey(tone: MorrowTone, past: boolean): string {
  if (tone === "coercive") return past ? "Directed" : "Directive";
  return past ? "Recommended" : "Recommends";
}
