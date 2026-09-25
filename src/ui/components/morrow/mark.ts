/**
 * Local fallback for the Morrow mark, used until/unless src/ui/brand ships a
 * `morrowMark`. Original geometry: a shallow lid resting on a horizon that
 * runs past it like a rail, a cobalt sun half-risen beneath the lid, and
 * short strokes fanning from the lid. Early on the strokes are sun rays and
 * the drawing is a dawn ("morrow"). As the stages rise the strokes lengthen
 * and thicken until they read as lashes, and the sun as an iris: the same
 * drawing becomes a watching eye.
 *
 * Everything that changes with stage is driven by CSS custom properties on
 * the window root (--mw-mark-w, --mw-ray, --mw-ray-outer), so a stage change
 * restyles every mark without rebuilding it.
 */
const SVG_NS = "http://www.w3.org/2000/svg";
let sequence = 0;

export interface MarkOptions {
  /** Rendered size in CSS px (square). */
  size?: number;
  /** Extra class on the <svg>. */
  className?: string;
}

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag) as SVGElementTagNameMap[K];
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

/** Horizon height in the 32-unit drawing. */
export const HORIZON_Y = 21.5;
const HALF_CHORD = 11;
const SAGITTA = 6.4;
const LID_R = (HALF_CHORD ** 2 + SAGITTA ** 2) / (2 * SAGITTA);
const LID_CY = HORIZON_Y + (LID_R - SAGITTA);
const RAY_GAP = 2.1;
const RAY_LEN = 3.6;
const round = (n: number) => Math.round(n * 100) / 100;

export function morrowMark(options: MarkOptions = {}): SVGSVGElement {
  const size = options.size ?? 24;
  const clip = `mw-horizon-${++sequence}`;
  const root = svg("svg", {
    viewBox: "0 0 32 32",
    width: size,
    height: size,
    class: `mw-mark${options.className ? ` ${options.className}` : ""}`,
    "aria-hidden": "true",
    focusable: "false",
  });
  const defs = svg("defs", {});
  const clipAbove = svg("clipPath", { id: clip });
  clipAbove.append(svg("rect", { x: 0, y: -8, width: 32, height: HORIZON_Y + 8 }));
  defs.append(clipAbove);

  const risen = svg("g", { "clip-path": `url(#${clip})` });
  risen.append(
    svg("circle", { class: "mw-mark-sun", cx: 16, cy: HORIZON_Y, r: 5.1, fill: "currentColor" }),
  );

  const stroke = {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.7,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  };
  const x0 = 16 - HALF_CHORD;
  const x1 = 16 + HALF_CHORD;
  const lid = svg("path", {
    class: "mw-mark-line mw-mark-lid",
    d: `M${x0} ${HORIZON_Y} A${round(LID_R)} ${round(LID_R)} 0 0 1 ${x1} ${HORIZON_Y}`,
    ...stroke,
  });
  const horizon = svg("line", {
    class: "mw-mark-line mw-mark-horizon",
    x1: 2,
    y1: HORIZON_Y,
    x2: 30,
    y2: HORIZON_Y,
    ...stroke,
  });
  const rays = svg("g", { class: "mw-mark-rays" });
  for (const degrees of [-46, -23, 0, 23, 46]) {
    const a = (degrees * Math.PI) / 180;
    const r0 = LID_R + RAY_GAP;
    const r1 = r0 + RAY_LEN;
    rays.append(
      svg("line", {
        class: `mw-mark-line mw-mark-ray${Math.abs(degrees) > 30 ? " mw-mark-ray-outer" : ""}`,
        x1: round(16 + Math.sin(a) * r0),
        y1: round(LID_CY - Math.cos(a) * r0),
        x2: round(16 + Math.sin(a) * r1),
        y2: round(LID_CY - Math.cos(a) * r1),
        pathLength: 1,
        ...stroke,
      }),
    );
  }
  root.append(defs, risen, rays, lid, horizon);
  return root;
}
