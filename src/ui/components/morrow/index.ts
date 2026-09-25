/**
 * Morrow's window — public surface. Styles: ./morrow.css (game.css @imports it).
 */
export {
  renderMorrow,
  finishMorrow,
  disposeMorrow,
  decisionKey,
  type MorrowView,
  type MorrowReply,
  type MorrowCues,
  type MorrowRecommendation,
  type MorrowAuthority,
  type MorrowTone,
} from "./window.ts";
export {
  modelLabel,
  statusLine,
  revisionLine,
  REVISION_LINES,
} from "./copy.ts";
