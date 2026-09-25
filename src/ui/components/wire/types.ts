/**
 * The wire's view model. Everything the renderer draws is in here; the
 * renderer never reaches into the engine, persistence or telemetry.
 */

export type WireSeverity = 0 | 1 | 2;

/** What a card is. "Breaking" is a flag on a headline, not a kind. */
export type WireKind = "headline" | "post" | "statement" | "morrow";

/**
 * Who is speaking.
 *  - outlet:   a fictional news organisation (The Ledger, Relay, ...)
 *  - official: an issuing body with a seal or a flag (Common Rail Authority)
 *  - lab:      a company voice (Vela). Morrow uses kind "morrow" instead.
 *  - person:   an account on the social layer
 */
export type WireSourceKind = "outlet" | "official" | "lab" | "person";

export interface WireSource {
  /** Brand key: outlet/entity id, or the handle for people. */
  id: string;
  name: string;
  /** Social handle without the leading "@", or null for outlets. */
  handle: string | null;
  kind: WireSourceKind;
  verified: boolean;
  /** Fictional nation for flags on statements. */
  nationId: string | null;
}

export interface WireEngagement {
  replies: number;
  reposts: number;
  likes: number;
}

export interface WireItem {
  /** Stable, unique key. Engine items are prefixed "news:". */
  id: string;
  origin: "engine" | "ambient";
  kind: WireKind;
  severity: WireSeverity;
  breaking: boolean;
  text: string;
  /** A short editorial desk label: "markets", "grid", "labor" ... */
  topic: string;
  /** Topic to draw a thumbnail for, or null for none. */
  thumbnailTopic: string | null;
  source: WireSource;
  /** World day (0-based) if known. */
  day: number | null;
  /** Minute of the day (0..1439) if known. */
  minute: number | null;
  /** Sort key, larger is newer. */
  order: number;
  /** Mono dateline shown on the card, e.g. "DAY 212 · 09:42". */
  dateLabel: string;
  isBot: boolean;
  engagement: WireEngagement | null;
  /** Engine decision this report follows from, if any. */
  causeId: string | null;
  /** Human wording for the cause, e.g. "Follows your ruling on the ward". */
  causeLabel: string | null;
  /** How many outlets carry the story (>= 1). */
  carriedBy: number;
}

export interface WireView {
  /** Any order; the renderer sorts newest-first by `order`. */
  items: WireItem[];
  /** Short lines for the marquee strip. */
  ticker: string[];
  /** A world-state figure shown under the header, or null. */
  factoid?: string | null;
  reducedMotion: boolean;
  /** Campaign stage 1..7. Tunes pace and alarm, never content. */
  stage: number;
  /** 0..1. How much of the social layer is automated. */
  botSaturation: number;
  /** Current world day, for "2 days ago". Defaults to the newest item's day. */
  today?: number | null;
  /** Item ids the reader has already seen (restored by the orchestrator). */
  readIds?: readonly string[];
  /** "panel" (floating side panel, default) or "sheet" (full-width phone sheet). */
  variant?: "panel" | "sheet";
}

export interface WireRenderOptions {
  /**
   * Where the marquee goes. undefined: inside the panel footer.
   * null: not rendered by renderWire (call renderTicker yourself).
   * An element: rendered into that element (e.g. a bottom-of-screen strip).
   */
  tickerHost?: HTMLElement | null;
  /** Items newly marked as read (seen for ~1s, focused, or opened). */
  onRead?: (ids: string[]) => void;
  /** A card was activated (click / Enter). */
  onOpen?: (item: WireItem) => void;
}

/**
 * Ambient feed items (src/ui/wire/ambient.ts). The adapter only reads these
 * fields and tolerates missing optional ones.
 */
export interface AmbientFeedItemLike {
  id: string;
  kind: "headline" | "post" | "statement" | "ticker" | "breaking" | "factoid";
  outletId?: string | null;
  outletName?: string | null;
  authorHandle?: string | null;
  authorName?: string | null;
  displayName?: string | null;
  personaId?: string | null;
  nationId?: string | null;
  topic?: string | null;
  text: string;
  dateLabel?: string | null;
  day?: number | null;
  isBot?: boolean;
  verified?: boolean;
  engagement?:
    | number
    | {
        replies?: number;
        reposts?: number;
        likes?: number;
        shares?: number;
        views?: number;
      }
    | null;
  thumbnailTopic?: string | null;
  severity?: number | null;
  sharedBy?: number | null;
}
