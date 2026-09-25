/**
 * Glossary, hover details and dilemma history.
 * CSS: import "./components/glossary/glossary.css" (after theme.css).
 */
export {
  annotate,
  annotateInto,
  descriptionId,
  DESCRIPTION_STORE_ID,
  TERM_CLASS,
  type AnnotateOptions,
} from "./annotate.ts";
export {
  mountGlossary,
  type GlossaryPopoverController,
  type GlossaryPopoverOptions,
  type OpenVia,
} from "./popover.ts";
export {
  renderHistoryCard,
  type HistoryCardHandle,
  type HistoryCardOptions,
} from "./history-card.ts";
export {
  renderGlossaryIndex,
  type GlossaryIndexHandle,
  type GlossaryIndexOptions,
} from "./glossary-index.ts";
export {
  GLOSSARY,
  DOMAIN_LABEL,
  glossaryEntry,
  findTermMatches,
  segmentText,
  sourceLinks,
  registrySource,
  type GlossaryEntry,
  type GlossaryDomain,
  type TermMatch,
  type SourceLink,
} from "../../content/glossary.ts";
export {
  HISTORY_CARDS,
  historyCardFor,
  BIBLIOGRAPHIC_LABEL,
  FAMILY_LABEL,
  type HistoryCard,
  type HistoryReference,
  type HistoryFamily,
} from "../../content/history.ts";
