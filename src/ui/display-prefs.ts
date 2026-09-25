/**
 * Display preferences that are not part of the research profile. Telemetry's
 * Preferences is a strict four-boolean contract; these live separately so
 * adding a volume slider never changes comparison keys or the collector.
 */
export interface DisplayPrefs {
  noFlashing: boolean;
  quality: "low" | "medium" | "high";
  volume: number;
}

const KEY = "trolley-display-v1";

export function displayPrefs(detected: DisplayPrefs["quality"] = "high"): DisplayPrefs {
  const fallback: DisplayPrefs = { noFlashing: matchMedia("(prefers-reduced-motion: reduce)").matches, quality: detected, volume: 0.7 };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<DisplayPrefs> | null;
    if (!raw) return fallback;
    return {
      noFlashing: typeof raw.noFlashing === "boolean" ? raw.noFlashing : fallback.noFlashing,
      quality: raw.quality === "low" || raw.quality === "medium" || raw.quality === "high" ? raw.quality : fallback.quality,
      volume: typeof raw.volume === "number" && raw.volume >= 0 && raw.volume <= 1 ? raw.volume : fallback.volume,
    };
  } catch {
    return fallback;
  }
}

export function saveDisplayPrefs(prefs: DisplayPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* Private windows may refuse storage; the setting still applies now. */
  }
}
