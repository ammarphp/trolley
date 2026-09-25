/**
 * The single import point for brand art used by the wire.
 *
 * src/ui/brand (logoFor, avatarFor, thumbnailFor, flagFor) is being built
 * concurrently. Until the orchestrator connects it with setWireBrand(), the
 * wire draws with the local pen-and-ink fallbacks below. Every mark is
 * fictional, monochrome ink on paper (cobalt only for Morrow), and seeded
 * from its id so a replay draws the same pictures.
 *
 * Styling hooks are classes (wb-*) defined in wire.css, so all colour comes
 * from theme tokens.
 */
import { pick } from "./hash.ts";
import { hatch, mulberry, nextId, path, root, s, toNode } from "./svg-kit.ts";
import { thumbnail } from "./thumbs.ts";

export { motifFor, wireMotifs } from "./thumbs.ts";

import type { BrandNode } from "./svg-kit.ts";
export type { BrandNode } from "./svg-kit.ts";

export interface WireBrand {
  /** Outlet / issuer mark. `name` helps monograms for unknown ids. */
  logo(outletId: string, options: { size: number; name?: string }): BrandNode;
  /** Account portrait. `blank` is the shared default face of collapsed bots. */
  avatar(
    handle: string,
    options: { bot: boolean; blank?: boolean; size: number },
  ): BrandNode;
  /** Line-art picture for a desk topic. `wide` is 16:9, otherwise square. */
  thumbnail(topic: string, seed: string, options: { wide: boolean }): BrandNode;
  flag(nationId: string, size: number): BrandNode;
  seal(issuerId: string, size: number): BrandNode;
  morrowMark(size: number): BrandNode;
}

function initials(name: string): string {
  const words = name
    .replace(/^the\s+/i, "")
    .split(/[\s\-_.]+/)
    .filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0]!.slice(0, 1).toUpperCase();
  return (words[0]!.slice(0, 1) + words[1]!.slice(0, 1)).toUpperCase();
}

/* ------------------------------------------------------------ logos */

function ledgerLogo(size: number) {
  const svg = root("0 0 16 16", size, size, "wb-logo");
  svg.append(
    s("rect", { x: 0.5, y: 0.5, width: 15, height: 15, rx: 3 }, "wb-f"),
  );
  for (const y of [5, 8, 11])
    svg.append(s("line", { x1: 3.2, y1: y, x2: 12.8, y2: y }, "wb-sp"));
  svg.append(s("line", { x1: 5.4, y1: 3, x2: 5.4, y2: 13 }, "wb-sp wb-thin"));
  return svg;
}

function relayLogo(size: number) {
  const svg = root("0 0 16 16", size, size, "wb-logo");
  svg.append(s("circle", { cx: 8, cy: 8, r: 7.5 }, "wb-f"));
  svg.append(
    path("M4.6 5.2 7.4 8l-2.8 2.8M8.6 5.2 11.4 8l-2.8 2.8", "wb-sp wb-thick"),
  );
  return svg;
}

function velaLogo(size: number) {
  const svg = root("0 0 16 16", size, size, "wb-logo");
  svg.append(
    s("rect", { x: 0.5, y: 0.5, width: 15, height: 15, rx: 7.5 }, "wb-p wb-s"),
  );
  svg.append(path("M4 4.6 8 11.6 12 4.6", "wb-s wb-thick"));
  return svg;
}

function railSeal(size: number) {
  const svg = root("0 0 32 32", size, size, "wb-seal");
  svg.append(s("circle", { cx: 16, cy: 16, r: 15 }, "wb-p wb-s"));
  svg.append(s("circle", { cx: 16, cy: 16, r: 11.6 }, "wb-s wb-thin"));
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r1 = 12.6;
    const r2 = 14;
    svg.append(
      s(
        "line",
        {
          x1: 16 + Math.cos(a) * r1,
          y1: 16 + Math.sin(a) * r1,
          x2: 16 + Math.cos(a) * r2,
          y2: 16 + Math.sin(a) * r2,
        },
        "wb-s wb-thin",
      ),
    );
  }
  svg.append(s("line", { x1: 13, y1: 7.5, x2: 11.4, y2: 24.5 }, "wb-s"));
  svg.append(s("line", { x1: 19, y1: 7.5, x2: 20.6, y2: 24.5 }, "wb-s"));
  for (const [y, w] of [
    [10, 3.4],
    [14.5, 4],
    [19, 4.6],
    [23.3, 5.2],
  ] as const)
    svg.append(
      s(
        "line",
        { x1: 16 - w - 0.6, y1: y, x2: 16 + w + 0.6, y2: y },
        "wb-s wb-thin",
      ),
    );
  return svg;
}

function genericSeal(id: string, size: number) {
  const svg = root("0 0 32 32", size, size, "wb-seal");
  svg.append(s("circle", { cx: 16, cy: 16, r: 15 }, "wb-p wb-s"));
  svg.append(s("circle", { cx: 16, cy: 16, r: 12 }, "wb-s wb-thin"));
  const points = 5 + pick(id, 4, "pts");
  const star: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 ? 3.4 : 8;
    star.push(
      `${(16 + Math.cos(a) * r).toFixed(2)},${(16 + Math.sin(a) * r).toFixed(2)}`,
    );
  }
  svg.append(s("polygon", { points: star.join(" ") }, "wb-f"));
  return svg;
}

function morrowMark(size: number) {
  const svg = root("0 0 16 16", size, size, "wb-morrow");
  svg.append(s("circle", { cx: 8, cy: 8, r: 7.25 }, "wb-scob wb-nofill"));
  svg.append(path("M3.4 9.4a4.6 4.6 0 0 1 9.2 0Z", "wb-cob"));
  svg.append(s("line", { x1: 1.6, y1: 9.4, x2: 14.4, y2: 9.4 }, "wb-scob"));
  svg.append(
    s("line", { x1: 5, y1: 11.9, x2: 11, y2: 11.9 }, "wb-scob wb-thin"),
  );
  return svg;
}

function monogram(id: string, name: string, size: number) {
  const svg = root("0 0 16 16", size, size, "wb-logo");
  const shape = pick(id, 4, "shape");
  if (shape === 0)
    svg.append(
      s("rect", { x: 0.5, y: 0.5, width: 15, height: 15, rx: 1.5 }, "wb-f"),
    );
  else if (shape === 1)
    svg.append(s("circle", { cx: 8, cy: 8, r: 7.5 }, "wb-f"));
  else if (shape === 2)
    svg.append(
      s("rect", { x: 0.5, y: 0.5, width: 15, height: 15, rx: 4.5 }, "wb-f"),
    );
  else svg.append(path("M0.5 0.5h15v11l-4 4h-11z", "wb-f"));
  const text = s(
    "text",
    { x: 8, y: 8.6, "text-anchor": "middle", "dominant-baseline": "middle" },
    "wb-letter",
  );
  const letters = initials(name || id);
  text.textContent = letters;
  if (letters.length > 1) text.setAttribute("class", "wb-letter wb-letter-2");
  svg.append(text);
  return svg;
}

function logo(
  outletId: string,
  options: { size: number; name?: string },
): Element {
  const id = outletId.toLowerCase();
  if (id === "ledger" || id === "the-ledger") return ledgerLogo(options.size);
  if (id === "relay") return relayLogo(options.size);
  if (id === "morrow") return morrowMark(options.size);
  if (id === "vela") return velaLogo(options.size);
  if (id === "common-rail" || id === "authority") return railSeal(options.size);
  return monogram(id, options.name ?? id, options.size);
}

/* ------------------------------------------------------------ avatars */

function avatar(
  handle: string,
  options: { bot: boolean; blank?: boolean; size: number },
): Element {
  const size = options.size;
  const svg = root("0 0 40 40", size, size, "wb-avatar");
  const clip = nextId("wbc");
  const defs = s("defs");
  const cp = s("clipPath", { id: clip });
  cp.append(s("circle", { cx: 20, cy: 20, r: 20 }));
  defs.append(cp);
  svg.append(defs);
  const g = s("g", { "clip-path": `url(#${clip})` });
  svg.append(g);
  if (options.blank) {
    // The default face: every collapsed account wears the same one.
    g.append(s("rect", { x: 0, y: 0, width: 40, height: 40 }, "wb-p3"));
    g.append(s("ellipse", { cx: 20, cy: 16.5, rx: 6.6, ry: 7.4 }, "wb-f4"));
    g.append(path("M4 42c1.4-9.6 7.8-14.6 16-14.6S34.6 32.4 36 42Z", "wb-f4"));
    return svg;
  }
  // An editorial ink portrait: no features, just hair, light and cloth.
  const r = mulberry(`avatar:${handle}`);
  const bg = pick(handle, 4, "bg");
  g.append(
    s(
      "rect",
      { x: 0, y: 0, width: 40, height: 40 },
      bg === 0 ? "wb-p3" : "wb-p2",
    ),
  );
  if (bg === 3)
    g.append(
      s("rect", {
        x: 0,
        y: 0,
        width: 40,
        height: 40,
        fill: hatch(svg, 2.4, 45, "wb-hs3"),
      }),
    );
  const hx = 20 + (r() - 0.5) * 2.4;
  const hy = 17 + (r() - 0.5) * 1.6;
  const rx = 6.2 + r() * 0.9;
  const ry = rx + 0.9 + r() * 0.6;
  const hair = pick(handle, 7, "hair");
  const jacket = pick(handle, 3, "jacket");
  const turn = r() < 0.5 ? 1 : -1; // which side the light comes from

  // long hair falls behind the shoulders
  if (hair === 2)
    g.append(
      path(
        `M${hx - rx - 1.6} ${hy + 11}C${hx - rx - 3} ${hy - ry - 3} ${hx + rx + 3} ${hy - ry - 3} ${hx + rx + 1.6} ${hy + 11}Z`,
        "wb-f",
      ),
    );

  // shoulders
  const sw = 13 + r() * 2.5;
  const shoulders = `M${hx - sw - 2} 42C${hx - sw} ${31 + r()} ${hx - 6} ${hy + ry + 2.4} ${hx} ${hy + ry + 2.4}S${hx + sw} ${31 + r()} ${hx + sw + 2} 42Z`;
  if (jacket === 0) g.append(path(shoulders, "wb-f"));
  else if (jacket === 1) {
    g.append(path(shoulders, "wb-p wb-s"));
    g.append(
      path(shoulders, "", {
        fill: hatch(svg, 1.9, turn > 0 ? 45 : -45, "wb-hs"),
      }),
    );
  } else g.append(path(shoulders, "wb-p wb-s"));
  // collar
  g.append(
    path(
      `M${hx - 3.4} ${hy + ry + 1.8}L${hx} ${hy + ry + 6.6}L${hx + 3.4} ${hy + ry + 1.8}`,
      jacket === 0 ? "wb-sp wb-nofill" : "wb-s wb-nofill wb-thin",
    ),
  );
  // neck
  g.append(
    path(
      `M${hx - 2.4} ${hy + ry - 2}v3.8q2.4 1.6 4.8 0v-3.8`,
      "wb-p wb-s wb-thin",
    ),
  );

  // head, with a hatched shadow on the far side
  const headClip = nextId("wbh");
  const hc = s("clipPath", { id: headClip });
  hc.append(s("ellipse", { cx: hx, cy: hy, rx, ry }));
  defs.append(hc);
  g.append(s("ellipse", { cx: hx, cy: hy, rx, ry }, "wb-p"));
  const shade = s("g", { "clip-path": `url(#${headClip})` });
  shade.append(
    s("rect", {
      x: turn > 0 ? hx + rx * 0.25 : hx - rx - 1,
      y: hy - ry,
      width: rx * 0.75 + 1,
      height: ry * 2,
      fill: hatch(svg, 1.6, turn > 0 ? 60 : -60, "wb-hs3"),
    }),
  );
  g.append(shade);
  g.append(s("ellipse", { cx: hx, cy: hy, rx, ry }, "wb-s wb-nofill"));

  // hair
  const top = hy - ry;
  if (hair === 0)
    g.append(
      path(
        `M${hx - rx - 0.3} ${hy - 0.5}C${hx - rx - 0.6} ${top - 2.6} ${hx + rx + 0.6} ${top - 2.6} ${hx + rx + 0.3} ${hy - 0.5}C${hx + rx - 1.6} ${hy - 4.6} ${hx - rx + 1.6} ${hy - 4.6} ${hx - rx - 0.3} ${hy - 0.5}Z`,
        "wb-f",
      ),
    );
  else if (hair === 1)
    g.append(
      path(
        `M${hx - rx - 0.4} ${hy + 1.5}C${hx - rx - 1.2} ${top - 3} ${hx + rx + 1.2} ${top - 3.4} ${hx + rx + 0.4} ${hy - 0.4}C${hx + 2.4} ${hy - 6.4} ${hx - 1.8} ${hy - 3} ${hx - rx - 0.4} ${hy + 1.5}Z`,
        "wb-f",
      ),
    );
  else if (hair === 2)
    g.append(
      path(
        `M${hx - rx - 0.4} ${hy + 2}C${hx - rx - 0.8} ${top - 2.8} ${hx + rx + 0.8} ${top - 2.8} ${hx + rx + 0.4} ${hy + 2}C${hx + rx - 2.2} ${hy - 3.6} ${hx - rx + 2.2} ${hy - 3.6} ${hx - rx - 0.4} ${hy + 2}Z`,
        "wb-f",
      ),
    );
  else if (hair === 3) {
    g.append(
      path(
        `M${hx - rx - 0.3} ${hy - 0.8}C${hx - rx - 0.6} ${top - 2.2} ${hx + rx + 0.6} ${top - 2.2} ${hx + rx + 0.3} ${hy - 0.8}C${hx + rx - 2} ${hy - 4.2} ${hx - rx + 2} ${hy - 4.2} ${hx - rx - 0.3} ${hy - 0.8}Z`,
        "wb-f",
      ),
    );
    g.append(
      s("circle", { cx: hx + turn * 1.2, cy: top - 2.2, r: 2.9 }, "wb-f"),
    );
  } else if (hair === 4) {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      g.append(
        s(
          "circle",
          {
            cx: hx + Math.cos(a) * rx * 0.86,
            cy: hy - 1.4 + Math.sin(a) * ry * 0.86,
            r: 2.5 + r() * 0.5,
          },
          "wb-f",
        ),
      );
    }
  } else if (hair === 5) {
    // close crop: stipple on the crown
    g.append(
      path(
        `M${hx - rx + 0.4} ${hy - 1.6}C${hx - rx + 0.2} ${top - 0.6} ${hx + rx - 0.2} ${top - 0.6} ${hx + rx - 0.4} ${hy - 1.6}`,
        "",
        { fill: hatch(svg, 1.2, 0, "wb-hs") },
      ),
    );
  }
  // hair === 6: bare head.
  if (pick(handle, 5, "beard") === 0)
    g.append(
      path(
        `M${hx - rx + 0.6} ${hy + 1.4}C${hx - rx + 1} ${hy + ry + 1.6} ${hx + rx - 1} ${hy + ry + 1.6} ${hx + rx - 0.6} ${hy + 1.4}C${hx + 2} ${hy + 4.8} ${hx - 2} ${hy + 4.8} ${hx - rx + 0.6} ${hy + 1.4}Z`,
        "",
        { fill: hatch(svg, 1.3, 90, "wb-hs") },
      ),
    );
  if (pick(handle, 4, "glasses") === 0) {
    g.append(
      s(
        "rect",
        { x: hx - 5.1, y: hy - 0.4, width: 4, height: 2.8, rx: 1.1 },
        "wb-s wb-thin wb-nofill",
      ),
    );
    g.append(
      s(
        "rect",
        { x: hx + 1.1, y: hy - 0.4, width: 4, height: 2.8, rx: 1.1 },
        "wb-s wb-thin wb-nofill",
      ),
    );
    g.append(
      s(
        "line",
        { x1: hx - 1.1, y1: hy + 0.6, x2: hx + 1.1, y2: hy + 0.6 },
        "wb-s wb-thin",
      ),
    );
  }
  return svg;
}

/* ------------------------------------------------------------ flags */

function flag(nationId: string, size: number): Element {
  const w = size;
  const h = Math.round(size * (2 / 3));
  const svg = root("0 0 30 20", w, h, "wb-flag");
  const kind = pick(nationId, 5, "flag");
  const tones = ["wb-f", "wb-p", "wb-f3", "wb-p3"];
  const t = (n: number) =>
    tones[(pick(nationId, 4, `tone${n}`) + n) % tones.length]!;
  svg.append(s("rect", { x: 0, y: 0, width: 30, height: 20 }, "wb-p"));
  if (kind === 0) {
    svg.append(s("rect", { x: 0, y: 0, width: 30, height: 6.67 }, t(0)));
    svg.append(s("rect", { x: 0, y: 13.33, width: 30, height: 6.67 }, t(2)));
  } else if (kind === 1) {
    svg.append(s("rect", { x: 0, y: 0, width: 10, height: 20 }, t(0)));
    svg.append(s("rect", { x: 20, y: 0, width: 10, height: 20 }, t(1)));
  } else if (kind === 2) {
    for (let i = 0; i < 5; i += 2)
      svg.append(s("rect", { x: 0, y: i * 4, width: 30, height: 4 }, "wb-f3"));
    svg.append(s("rect", { x: 0, y: 0, width: 13, height: 12 }, "wb-f"));
    svg.append(s("circle", { cx: 6.5, cy: 6, r: 2.4 }, "wb-p"));
  } else if (kind === 3) {
    svg.append(path("M0 20 30 0v20Z", t(0)));
    svg.append(s("circle", { cx: 8, cy: 7, r: 3 }, "wb-f"));
  } else {
    svg.append(s("rect", { x: 9, y: 0, width: 4, height: 20 }, "wb-f"));
    svg.append(s("rect", { x: 0, y: 8, width: 30, height: 4 }, "wb-f"));
  }
  svg.append(
    s(
      "rect",
      { x: 0.25, y: 0.25, width: 29.5, height: 19.5 },
      "wb-s wb-thin wb-nofill",
    ),
  );
  return svg;
}

function seal(issuerId: string, size: number): Element {
  const id = issuerId.toLowerCase();
  if (id === "common-rail" || id === "authority") return railSeal(size);
  if (id === "morrow") return morrowMark(size);
  if (id === "vela") return velaLogo(size);
  return genericSeal(id, size);
}

/* ------------------------------------------------------------ icons */

const ICONS: Record<string, string> = {
  reply:
    "M3.2 4.2h9.6a1.3 1.3 0 0 1 1.3 1.3v5a1.3 1.3 0 0 1-1.3 1.3H7.6l-3 2.4v-2.4H3.2a1.3 1.3 0 0 1-1.3-1.3v-5a1.3 1.3 0 0 1 1.3-1.3Z",
  repost:
    "M4 6.2V5a1 1 0 0 1 1-1h7.4M10.6 2l1.8 2-1.8 2M12 9.8V11a1 1 0 0 1-1 1H3.6M5.4 14l-1.8-2 1.8-2",
  like: "M8 13.4S2.2 10.2 2.2 6.2A2.9 2.9 0 0 1 8 4.8a2.9 2.9 0 0 1 5.8 1.4c0 4-5.8 7.2-5.8 7.2Z",
  close: "M4 4l8 8M12 4l-8 8",
  up: "M8 13V3.5M4 7.5l4-4 4 4",
  pause: "M5.5 3.5v9M10.5 3.5v9",
  play: "M5 3.2v9.6L12.6 8Z",
  chevron: "M6 4l4 4-4 4",
};

export function icon(
  name: keyof typeof ICONS | string,
  size = 14,
): SVGSVGElement {
  const svg = root("0 0 16 16", size, size, `wb-icon wb-icon-${name}`);
  svg.append(path(ICONS[name] ?? "", name === "play" ? "wb-fi" : "wb-si"));
  return svg;
}

/** Verification rosette with a check. */
export function verifiedBadge(size = 13): SVGSVGElement {
  const svg = root("0 0 16 16", size, size, "wb-verified");
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 6.4 : 7.6;
    pts.push(
      `${(8 + Math.cos(a) * r).toFixed(2)},${(8 + Math.sin(a) * r).toFixed(2)}`,
    );
  }
  svg.append(s("polygon", { points: pts.join(" ") }, "wb-f"));
  svg.append(path("M5.2 8.2 7.1 10l3.8-4", "wb-sp wb-thick wb-nofill"));
  return svg;
}

/* ------------------------------------------------------------ bridge */

const FALLBACK: WireBrand = { logo, avatar, thumbnail, flag, seal, morrowMark };
let active: WireBrand = { ...FALLBACK };

/**
 * Connect the real brand module (src/ui/brand) here, once, at start-up:
 *   setWireBrand({ logo: (id, o) => logoFor(id, { size: o.size, variant: "mark" }), ... })
 * Anything not supplied keeps the local fallback. Returned strings are parsed
 * as SVG (scripts stripped); returned elements are used as-is.
 */
export function setWireBrand(partial: Partial<WireBrand>): void {
  active = { ...FALLBACK, ...partial };
}

export const wireBrand = {
  logo: (id: string, o: { size: number; name?: string }) =>
    safe(
      () => active.logo(id, o),
      () => FALLBACK.logo(id, o),
    ),
  avatar: (h: string, o: { bot: boolean; blank?: boolean; size: number }) =>
    safe(
      () => active.avatar(h, o),
      () => FALLBACK.avatar(h, o),
    ),
  thumbnail: (t: string, seed: string, o: { wide: boolean }) =>
    safe(
      () => active.thumbnail(t, seed, o),
      () => FALLBACK.thumbnail(t, seed, o),
    ),
  flag: (n: string, size: number) =>
    safe(
      () => active.flag(n, size),
      () => FALLBACK.flag(n, size),
    ),
  seal: (id: string, size: number) =>
    safe(
      () => active.seal(id, size),
      () => FALLBACK.seal(id, size),
    ),
  morrowMark: (size: number) =>
    safe(
      () => active.morrowMark(size),
      () => FALLBACK.morrowMark(size),
    ),
};

function safe(primary: () => BrandNode, fallback: () => BrandNode): Element {
  try {
    return toNode(primary());
  } catch {
    return toNode(fallback());
  }
}
