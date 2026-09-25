/**
 * The instrument cluster's view model. The renderer draws exactly this; it
 * never reaches into the engine, persistence or telemetry. Values are
 * REPORTED observations (World.observations), which institutions can alter.
 * The windshield shows the truth; this cluster shows what was reported.
 */

export type InstrumentKey =
  | "gdp"
  | "capability"
  | "casualties"
  | "population"
  | "power"
  | "care"
  | "food";

export interface InstrumentMetric {
  key: InstrumentKey;
  /** Short visible name, e.g. "GDP", "Capability", "Fatalities". */
  label: string;
  /** The reported value. */
  value: number;
  /**
   * Reported values, oldest first. The last entry is normally the current
   * value; if it is not, the renderer treats `value` as the newest point.
   */
  history: number[];
  /** Optional unit shown after the digits (e.g. "idx"). */
  unit?: string;
  /**
   * Optional authored display string. Replaces the computed number in the
   * digit window; accessible text still carries full precision.
   */
  display?: string;
  /** True when an institution issued this reading (Observation.altered). */
  altered?: boolean;
  /** Observation.source: "Local instrument" or the institution's label. */
  source?: string;
  /**
   * Scale ceiling. GDP/capability/supply: linear maximum (auto-extends if the
   * value exceeds it). Casualties: top of the log scale (e.g. the initial
   * population). Population: the reference total.
   */
  scaleMax?: number;
}

export interface InstrumentsView {
  stage: number;
  /** Displayed verbatim as "Day N": pass the player-facing day. */
  day: number;
  /** Displayed verbatim in the header, e.g. "14 Mar 2031". */
  dateLabel: string;
  reducedMotion: boolean;
  /** Primary gauges in display order (normally gdp, capability, casualties). */
  metrics: InstrumentMetric[];
  /** Stage >= 5: power, care, food (1000 = baseline) and population. */
  secondary?: InstrumentMetric[];
  /**
   * The self-test boot sequence runs the first time a host shows the cluster
   * at stage >= 4. Pass false to suppress it (e.g. restoring a late save).
   */
  boot?: boolean;
  /** Called once when the boot sequence completes or is skipped. */
  onBootComplete?: () => void;
}

/** How a metric is drawn. Derived from its key. */
export type GaugeKind = "index" | "notch" | "log" | "count";
