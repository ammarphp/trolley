/**
 * Ending and debrief. The orchestrator imports this module and
 * `./debrief.css`; nothing here touches the engine, persistence or telemetry.
 */
export {
  renderDebrief,
  disposeDebrief,
  setReplayReady,
  type DebriefHandle,
} from "./render.ts";
export {
  selectTurningPoints,
  attributeConsequences,
  executionLine,
  chancePhrase,
  revealHiddenFacts,
  deriveAuthorityTimeline,
  describeAuthority,
  recordSeries,
  populationCaption,
  type DebriefView,
  type DebriefActions,
  type DebriefNode,
  type TurningPoint,
  type TurningKind,
  type Strand,
  type Consequence,
  type HiddenFinding,
  type HiddenFact,
  type AuthorityCell,
  type Authority,
  type RecordSeries,
} from "./model.ts";
export {
  EPIGRAPHS,
  FACT_SENTENCES,
  HIDDEN_FACT_COPY,
  FAMILY_NAMES,
} from "./copy.ts";
