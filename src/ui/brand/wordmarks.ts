/**
 * The game's own wordmark, "trolley." — lower-case Geist, tight, with the
 * full stop as a true circle in signal red: the one red thing on the page,
 * the stop that never comes.
 *
 * Variants:
 *   plain  the wordmark alone (matches the HUD's CSS wordmark)
 *   rail   two hairline rails run under the word and end at the dot, which
 *          becomes a buffer-stop lamp
 */
import { INK, PAPER, PIGMENT } from "./palette.ts";
import { el, n, svgDoc, text, textWidth } from "./svg.ts";

export interface TrolleyWordmarkOptions {
  /** Rendered height in px. Default 48. */
  height?: number;
  variant?: "plain" | "rail";
  /** "ink" on paper (default) or "reverse" on dark grounds. */
  tone?: "ink" | "reverse";
  /** Replace the red full stop with ink (e.g. monochrome print). */
  monochrome?: boolean;
  title?: string;
}

const SIZE = 100;
const WEIGHT = 650;
const TRACK = -0.055;

export function trolleyWordmark(options: TrolleyWordmarkOptions = {}): string {
  const h = options.height ?? 48;
  const ink = options.tone === "reverse" ? PAPER : INK;
  const dotColor = options.monochrome ? ink : PIGMENT.signal;
  const word = "trolley";
  const w = textWidth(word, { size: SIZE, weight: WEIGHT, tracking: TRACK });
  const baseline = 86;
  // The stop: diameter matched to Geist's stem at this weight, set close.
  const r = SIZE * 0.068;
  const dotX = w + SIZE * 0.035 + r;
  const dotY = baseline - r;
  let body = text(word, { x: 0, y: baseline, size: SIZE, weight: WEIGHT, tracking: TRACK, fill: ink });
  let width = dotX + r + 2;
  let height = 112;
  if (options.variant === "rail") {
    const y1 = baseline + 14;
    const y2 = baseline + 19;
    body += el("path", { d: `M0 ${y1}H${n(dotX)}M0 ${y2}H${n(dotX)}`, stroke: ink, "stroke-width": 1.5, fill: "none" });
    let sleepers = "";
    for (let x = 6; x < dotX - 10; x += 17) sleepers += `M${n(x)} ${y1 - 3}V${y2 + 3}`;
    body += el("path", { d: sleepers, stroke: ink, "stroke-width": 3, fill: "none" });
    // Buffer stop under the dot.
    body += el("rect", { x: dotX - 4, y: y1 - 6, width: 8, height: y2 - y1 + 12, fill: ink });
    height = 124;
    width = Math.max(width, dotX + 6);
  }
  body += el("circle", { cx: dotX, cy: dotY, r, fill: dotColor });
  return svgDoc(body, {
    viewBox: [0, 0, width, height],
    width: (width / height) * h,
    height: h,
    title: options.title ?? "trolley.",
    className: "brand-trolley",
  });
}
