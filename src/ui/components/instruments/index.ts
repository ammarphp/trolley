/**
 * Instrument cluster (stage >= 4): reported GDP, capability and fatalities,
 * with supply systems and population from stage 5. Import the stylesheet
 * `src/ui/components/instruments/instruments.css` once.
 */
export {
  renderInstruments,
  disposeInstruments,
  settleInstruments,
} from "./render.ts";
export type {
  InstrumentKey,
  InstrumentMetric,
  InstrumentsView,
} from "./types.ts";
export {
  INSTITUTIONAL_TAG,
  formatCount,
  formatFull,
  formatIndex,
  provenanceOf,
} from "./model.ts";
