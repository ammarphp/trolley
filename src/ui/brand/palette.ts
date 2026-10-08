/**
 * Brand inks. The same paper, ink and pigments as the ink world and the UI
 * theme (src/ui/theme.css), so a mark in the feed and a lamp in the world are
 * the same colour. Pigment means something:
 *
 *   signal  danger, the jam, the full stop in "trolley."
 *   blood   consequence only
 *   amber   hi-vis, work lights, an on-air lamp
 *   cobalt  Morrow, and nothing else
 *   cyan    server status lamps
 *   leaf    rare living green
 *   ember   fire
 *
 * Flags are the one place with a wider palette: a restrained set of printed
 * inks (FLAG_INK) that look like a two- or three-colour letterpress job.
 */
export const INK = "#111214";
export const INK_2 = "#4c4f55";
export const INK_3 = "#7d8087";
export const INK_4 = "#a9abb0";
export const PAPER = "#ffffff";
export const PAPER_2 = "#f6f6f4";
export const PAPER_3 = "#eeeeeb";

export const PIGMENT = {
  signal: "#d2281e",
  blood: "#9e0d12",
  amber: "#e39a2d",
  cobalt: "#2b4df2",
  cyan: "#2fb8c6",
  leaf: "#4d8c47",
  ember: "#f26b1f",
} as const;
export type PigmentName = keyof typeof PIGMENT;

/** Printed flag inks: muted, flat, never neon. */
export const FLAG_INK = {
  paper: "#fbfaf6",
  ink: "#15171a",
  vermilion: "#c3372a",
  oxblood: "#6f1d24",
  prussian: "#1d3a63",
  slate: "#5b7898",
  sky: "#8db1cf",
  ochre: "#c8952f",
  pine: "#2d5a45",
  teal: "#1f6c6c",
} as const;
export type FlagInk = keyof typeof FLAG_INK;

export const FONT_SANS = "Geist, Inter, sans-serif";
export const FONT_MONO = "'Geist Mono', ui-monospace, Menlo, monospace";
