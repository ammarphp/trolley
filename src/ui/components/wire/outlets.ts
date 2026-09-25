/**
 * The four voices the engine can publish through, and a polite fallback for
 * any outlet id the ambient layer invents. All names are fictional.
 */
import type { WireSourceKind } from "./types.ts";

export interface OutletInfo {
  id: string;
  name: string;
  kind: WireSourceKind;
  verified: boolean;
  /** Short descriptor for hover details. */
  desk: string;
}

export const ENGINE_OUTLETS: Record<
  "Ledger" | "Relay" | "Authority" | "Morrow",
  OutletInfo
> = {
  Ledger: {
    id: "ledger",
    name: "The Ledger",
    kind: "outlet",
    verified: true,
    desk: "Business daily",
  },
  Relay: {
    id: "relay",
    name: "Relay",
    kind: "outlet",
    verified: true,
    desk: "Wire service",
  },
  Authority: {
    id: "common-rail",
    name: "Common Rail Authority",
    kind: "official",
    verified: true,
    desk: "Official notice",
  },
  Morrow: {
    id: "morrow",
    name: "Morrow",
    kind: "lab",
    verified: true,
    desk: "Vela assistant",
  },
};

const BY_ID = new Map(
  Object.values(ENGINE_OUTLETS).map((info) => [info.id, info] as const),
);

/** "north-signal" -> "North Signal". */
export function titleFromId(id: string): string {
  return id
    .replace(/^@/, "")
    .split(/[-_.:\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function outletInfo(
  id: string,
  overrides?: Record<
    string,
    { name: string; kind?: WireSourceKind; verified?: boolean; desk?: string }
  >,
  fallbackName?: string | null,
): OutletInfo {
  const override = overrides?.[id];
  const known = BY_ID.get(id);
  return {
    id,
    name: override?.name ?? fallbackName ?? known?.name ?? titleFromId(id),
    kind: override?.kind ?? known?.kind ?? "outlet",
    verified: override?.verified ?? known?.verified ?? true,
    desk: override?.desk ?? known?.desk ?? "News",
  };
}

export function isMorrowId(id: string | null | undefined): boolean {
  if (!id) return false;
  const bare = id.replace(/^@/, "").toLowerCase();
  return bare === "morrow" || bare === "vela-morrow" || bare === "morrow.vela";
}
