/**
 * The wire: news and social feed, ticker, breaking and factoid banners.
 * Import the stylesheet once: @import "./components/wire/wire.css";
 */
export {
  renderWire,
  disposeWire,
  wireReadIds,
  type WireFilter,
} from "./wire.ts";
export { renderTicker, disposeTicker, type TickerView } from "./ticker.ts";
export {
  toWireItems,
  toWireView,
  engineNewsToWire,
  ambientToWire,
  wireTickerLines,
  wireFactoid,
  tickerText,
  normalizeTickerLines,
  inferTopic,
  inferSeverity,
  relativeAge,
  calendarFormatter,
  type WireNormalizeOptions,
} from "./normalize.ts";
export {
  buildWireEntries,
  saturationLevels,
  representedCount,
  phraseKey,
  type WireEntry,
  type SaturationLevels,
} from "./saturation.ts";
export {
  reconcileKeyed,
  type KeyedHost,
  type ReconcileResult,
} from "./keyed.ts";
export {
  setWireBrand,
  type WireBrand,
  type BrandNode,
} from "./brand-bridge.ts";
export type {
  WireItem,
  WireView,
  WireKind,
  WireSeverity,
  WireSource,
  WireSourceKind,
  WireEngagement,
  WireRenderOptions,
  AmbientFeedItemLike,
} from "./types.ts";
