/**
 * Fallback news illustrations: pen-and-ink plates, one per desk topic.
 *
 * Every plate is drawn in a 160x90 field with depth: a sky of ruled strokes,
 * a horizon, a ground plane in perspective, a mid-ground subject and heavier
 * foreground ink. The square thumbnail crops the centre (x 35..125), so each
 * subject is composed around it. Seeded per story so no two cards match.
 */
import { hash32 } from "./hash.ts";
import { hatch, mulberry, path, root, s } from "./svg-kit.ts";

type R = () => number;
interface Plate {
  svg: SVGSVGElement;
  r: R;
  variant: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const f = (n: number) => Number(n.toFixed(2));

function line(
  p: Plate,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cls: string,
  attrs: Record<string, string | number> = {},
) {
  p.svg.append(
    s("line", { x1: f(x1), y1: f(y1), x2: f(x2), y2: f(y2), ...attrs }, cls),
  );
}

function text(
  p: Plate,
  x: number,
  y: number,
  value: string,
  cls: string,
  anchor = "start",
) {
  const t = s("text", { x: f(x), y: f(y), "text-anchor": anchor }, cls);
  t.textContent = value;
  p.svg.append(t);
}

/* ------------------------------------------------------------ atmosphere */

function skyStrokes(p: Plate, y0 = 8, y1 = 30, n = 3) {
  for (let i = 0; i < n; i++) {
    const y = y0 + p.r() * (y1 - y0);
    const x = 6 + p.r() * 90;
    const len = 24 + p.r() * 46;
    p.svg.append(
      path(
        `M${f(x)} ${f(y)}h${f(len)}M${f(x + 8 + p.r() * 10)} ${f(y + 3)}h${f(len * 0.6)}`,
        "wb-s3",
      ),
    );
  }
}

function sun(p: Plate, x: number, y: number, rad: number, moon = false) {
  if (moon) {
    p.svg.append(s("circle", { cx: f(x), cy: f(y), r: f(rad) }, "wb-f"));
    p.svg.append(
      s(
        "circle",
        { cx: f(x + rad * 0.45), cy: f(y - rad * 0.25), r: f(rad * 0.92) },
        "wb-p",
      ),
    );
    return;
  }
  p.svg.append(
    s("circle", {
      cx: f(x),
      cy: f(y),
      r: f(rad),
      fill: hatch(p.svg, 1.8, 0, "wb-hs3"),
    }),
  );
  p.svg.append(
    s("circle", { cx: f(x), cy: f(y), r: f(rad) }, "wb-s wb-thin wb-nofill"),
  );
}

function hills(p: Plate, horizon: number, amp = 4) {
  let d = `M-6 ${horizon}`;
  let x = -6;
  while (x < 166) {
    const w = 10 + p.r() * 18;
    d += `Q${f(x + w / 2)} ${f(horizon - p.r() * amp * 2)} ${f(x + w)} ${f(horizon - p.r() * amp * 0.4)}`;
    x += w;
  }
  p.svg.append(path(d, "wb-s3 wb-nofill"));
  line(p, -6, horizon, 166, horizon, "wb-s wb-thin");
}

function groundPerspective(
  p: Plate,
  horizon: number,
  vx: number,
  spacing = 15,
) {
  for (let x = -120; x <= 280; x += spacing)
    line(p, vx, horizon, x, 96, "wb-s4");
  for (const t of [0.06, 0.16, 0.32, 0.56, 0.9]) {
    const y = lerp(horizon, 92, t);
    line(p, -6, y, 166, y, "wb-s4");
  }
}

function figure(p: Plate, x: number, base: number, h: number, cls = "wb-f") {
  p.svg.append(
    s("circle", { cx: f(x), cy: f(base - h * 0.86), r: f(h * 0.13) }, cls),
  );
  p.svg.append(
    path(
      `M${f(x - h * 0.17)} ${f(base)}L${f(x - h * 0.13)} ${f(base - h * 0.62)}Q${f(x)} ${f(base - h * 0.74)} ${f(x + h * 0.13)} ${f(base - h * 0.62)}L${f(x + h * 0.17)} ${f(base)}Z`,
      cls,
    ),
  );
}

function tree(p: Plate, x: number, base: number, h: number) {
  const rad = h * 0.34;
  const cy = base - h + rad;
  line(p, x, base, x, cy + rad * 0.4, "wb-s");
  p.svg.append(s("circle", { cx: f(x), cy: f(cy), r: f(rad) }, "wb-p wb-s"));
  const clip = `M${f(x)} ${f(cy - rad)}a${f(rad)} ${f(rad)} 0 0 1 0 ${f(rad * 2)}Z`;
  p.svg.append(path(clip, "", { fill: hatch(p.svg, 1.7, 45, "wb-hs3") }));
}

/** A ward in one-point perspective: beds, a window, a drip stand. */
function ward(p: Plate) {
  const vx = 82 + (p.r() - 0.5) * 8;
  const vy = 40;
  const at = (x: number, y: number, t: number) =>
    [lerp(x, vx, t), lerp(y, vy, t)] as const;
  const B = 0.66;
  const [bx0, by0] = at(-6, -6, B);
  const [bx1, by1] = at(166, 96, B);
  p.svg.append(
    s(
      "rect",
      { x: f(bx0), y: f(by0), width: f(bx1 - bx0), height: f(by1 - by0) },
      "wb-p wb-s wb-thin",
    ),
  );
  for (const [x, y] of [
    [-6, -6],
    [166, -6],
    [-6, 96],
    [166, 96],
  ] as const) {
    const [ex, ey] = at(x, y, B);
    line(p, x, y, ex, ey, "wb-s wb-thin");
  }
  // window on the back wall, light hatched
  const wx = vx - 14;
  const wy = by0 + 8;
  p.svg.append(
    s("rect", {
      x: f(wx),
      y: f(wy),
      width: 28,
      height: 18,
      fill: hatch(p.svg, 1.8, 30, "wb-hs3"),
    }),
  );
  p.svg.append(
    s("rect", { x: f(wx), y: f(wy), width: 28, height: 18 }, "wb-s wb-nofill"),
  );
  line(p, wx + 14, wy, wx + 14, wy + 18, "wb-s wb-thin");
  line(p, wx, wy + 9, wx + 28, wy + 9, "wb-s wb-thin");
  // floor seams
  for (let k = 1; k < 6; k++) {
    const t = (1 - Math.pow(0.66, k)) * B;
    const [x0, y0] = at(-6, 96, t);
    const [x1] = at(166, 96, t);
    line(p, x0, y0, x1, y0, "wb-s4");
  }
  // beds along both walls, receding
  for (const side of [-1, 1] as const) {
    const wall = side < 0 ? -6 : 166;
    for (let k = 0; k < 3; k++) {
      const tA = 0.08 + k * 0.19;
      const tB = tA + 0.12;
      const [xa, ya] = at(wall, 84, tA);
      const [xb, yb] = at(wall, 84, tB);
      const depthA = 1 - tA;
      const depthB = 1 - tB;
      const reachA = 46 * depthA * -side;
      const reachB = 46 * depthB * -side;
      const hA = 9 * depthA;
      const hB = 9 * depthB;
      const top = `M${f(xa)} ${f(ya - hA)}L${f(xb)} ${f(yb - hB)}L${f(xb + reachB)} ${f(yb - hB)}L${f(xa + reachA)} ${f(ya - hA)}Z`;
      p.svg.append(path(top, "wb-p wb-s"));
      p.svg.append(
        path(
          `M${f(xa + reachA)} ${f(ya - hA)}V${f(ya)}M${f(xb + reachB)} ${f(yb - hB)}V${f(yb)}M${f(xa + reachA)} ${f(ya - hA * 0.45)}L${f(xb + reachB)} ${f(yb - hB * 0.45)}`,
          "wb-s wb-thin",
        ),
      );
      p.svg.append(
        path(
          `M${f(xa + reachA * 0.12)} ${f(ya - hA - 1)}L${f(xb + reachB * 0.12)} ${f(yb - hB - 1)}L${f(xb + reachB * 0.3)} ${f(yb - hB - 1)}L${f(xa + reachA * 0.3)} ${f(ya - hA - 1)}Z`,
          "wb-p wb-s wb-thin",
        ),
      );
      if (k === 0) {
        const sx = xa + reachA * 1.12;
        line(p, sx, ya, sx, ya - 46 * depthA, "wb-s wb-thin");
        p.svg.append(
          s(
            "rect",
            {
              x: f(sx - 3 * depthA),
              y: f(ya - 46 * depthA),
              width: f(6 * depthA),
              height: f(8 * depthA),
              rx: 1,
            },
            "wb-p wb-s wb-thin",
          ),
        );
      }
    }
  }
}

/** The empty state: two poles and a sagging line with one bird on it. */
export function quietWire(width = 120): SVGSVGElement {
  const svg = root("0 0 120 44", width, (width * 44) / 120, "wb-quiet");
  svg.append(path("M14 42V8M8 12h12M106 42V8M100 12h12", "wb-s"));
  svg.append(
    path("M9 12Q60 30 111 12M19 12Q60 26 101 12", "wb-s wb-thin wb-nofill"),
  );
  svg.append(
    path(
      "M66 21.2c1.4-2.6 4.6-2.8 5.6-.6l2.4-.6-2 1.6c-.6 1.8-3.4 2.4-6 .4Z",
      "wb-f",
    ),
  );
  svg.append(path("M69 22.4v1.6M71 22.2v1.6", "wb-s wb-thin"));
  return svg;
}

/* ------------------------------------------------------------ motifs */

type Motif = (p: Plate) => void;

const MOTIFS: Record<string, Motif> = {
  markets(p) {
    for (let x = 14; x <= 150; x += 17) line(p, x, 8, x, 72, "wb-s4");
    for (let y = 14; y <= 72; y += 14.5) line(p, 6, y, 154, y, "wb-s4");
    const pts: [number, number][] = [];
    let y = 60 + p.r() * 6;
    for (let x = 24; x <= 142; x += 4.5) {
      y = Math.max(18, Math.min(68, y - 1.8 + (p.r() - 0.44) * 8));
      pts.push([x, y]);
    }
    if (p.variant === 1) {
      // the fall after the rise
      const n = pts.length;
      for (let i = Math.floor(n * 0.7); i < n; i++)
        pts[i]![1] = Math.min(70, pts[i]![1] + (i - n * 0.7) * 3.4);
    }
    const hi = Math.min(
      ...pts.slice(0, Math.floor(pts.length * 0.6)).map((q) => q[1]),
    );
    line(p, 22, hi, 154, hi, "wb-s3", { "stroke-dasharray": "2 2" });
    const d = pts
      .map(([x, yy], i) => `${i ? "L" : "M"}${f(x)} ${f(yy)}`)
      .join("");
    const lastX = pts[pts.length - 1]![0];
    p.svg.append(
      path(`${d}L${f(lastX)} 74L24 74Z`, "", { fill: hatch(p.svg, 2, 45) }),
    );
    p.svg.append(path(d, "wb-s wb-thick wb-nofill"));
    const [lx, ly] = pts[pts.length - 1]!;
    p.svg.append(
      s("circle", { cx: f(lx), cy: f(ly), r: 5.5 }, "wb-s3 wb-nofill"),
    );
    p.svg.append(s("circle", { cx: f(lx), cy: f(ly), r: 2.4 }, "wb-f"));
    const pct = `${p.variant === 1 ? "−" : "+"}${(4 + p.r() * 20).toFixed(1)}%`;
    p.svg.append(
      s(
        "rect",
        { x: f(lx - 31), y: f(ly - 16), width: 25, height: 9, rx: 1.5 },
        "wb-f",
      ),
    );
    text(p, lx - 18.5, ly - 9.6, pct, "wb-num wb-num-p", "middle");
    for (let i = 0; i < 4; i++)
      text(
        p,
        8,
        14 + i * 14.5 - 1.5,
        `${(3.2 - i * 0.6).toFixed(1)}T`,
        "wb-num",
      );
    for (let x = 24; x <= 142; x += 4.5) {
      const h = 2 + p.r() * 9;
      p.svg.append(
        s(
          "rect",
          { x: f(x - 1.4), y: f(88 - h), width: 2.8, height: f(h) },
          p.r() < 0.3 ? "wb-f3" : "wb-f2",
        ),
      );
    }
  },

  datacenter(p) {
    const horizon = 50;
    const vx = 176;
    skyStrokes(p, 6, 24);
    hills(p, horizon, 2.5);
    groundPerspective(p, horizon, 70, 14);
    const cx = 44;
    const top = 24;
    const bot = 74;
    const T = 0.74;
    const at = (t: number) => ({
      x: lerp(cx, vx, t),
      yT: lerp(top, horizon - 1, t),
      yB: lerp(bot, horizon + 1, t),
    });
    const far = at(T);
    // front face
    p.svg.append(
      path(`M-4 ${top + 3}L${cx} ${top}V${bot}L-4 ${bot}Z`, "wb-p wb-s"),
    );
    for (let x = 2; x < cx - 2; x += 8)
      p.svg.append(
        s(
          "rect",
          { x, y: bot - 14, width: 6, height: 14 },
          x % 16 === 2 ? "wb-f" : "wb-f3",
        ),
      );
    line(p, -4, top + 9, cx, top + 7, "wb-s wb-thin");
    // side face, in shadow
    const side = `M${cx} ${top}L${f(far.x)} ${f(far.yT)}L${f(far.x)} ${f(far.yB)}L${cx} ${bot}Z`;
    p.svg.append(path(side, "wb-p wb-s"));
    p.svg.append(path(side, "", { fill: hatch(p.svg, 2.1, 70) }));
    for (let k = 1; k < 12; k++) {
      const q = at((k / 12) * T);
      line(p, q.x, q.yT, q.x, q.yB, "wb-s wb-thin");
    }
    // roof plant, diminishing
    for (let k = 0; k < 9; k++) {
      const t = ((k + 0.5) / 9) * T;
      const q = at(t);
      const sc = 1 - t * 0.85;
      p.svg.append(
        s(
          "rect",
          {
            x: f(q.x - 4 * sc),
            y: f(q.yT - 3.4 * sc),
            width: f(8 * sc),
            height: f(3.4 * sc),
          },
          "wb-p wb-s wb-thin",
        ),
      );
      p.svg.append(
        s(
          "ellipse",
          {
            cx: f(q.x),
            cy: f(q.yT - 3.4 * sc),
            rx: f(3.2 * sc),
            ry: f(1.1 * sc),
          },
          "wb-f2",
        ),
      );
      if (k % 3 === 1)
        p.svg.append(
          path(
            `M${f(q.x)} ${f(q.yT - 5 * sc)}c${f(-4 * sc)} ${f(-5 * sc)} ${f(4 * sc)} ${f(-7 * sc)} 0 ${f(-13 * sc)}`,
            "wb-s3 wb-nofill",
          ),
        );
    }
    // pylons marching away on the right
    for (let k = 0; k < 4; k++) {
      const sc = Math.pow(0.6, k);
      const x = lerp(150, 112, 1 - sc);
      const base = lerp(90, horizon, 1 - sc);
      const h = 34 * sc;
      p.svg.append(
        path(
          `M${f(x - 3 * sc)} ${f(base)}L${f(x)} ${f(base - h)}L${f(x + 3 * sc)} ${f(base)}M${f(x - 5 * sc)} ${f(base - h * 0.8)}h${f(10 * sc)}`,
          "wb-s wb-thin wb-nofill",
        ),
      );
    }
  },

  lab(p) {
    const vx = 80 + (p.r() - 0.5) * 10;
    const vy = 42;
    const at = (x: number, y: number, t: number) =>
      [lerp(x, vx, t), lerp(y, vy, t)] as const;
    const B = 0.8;
    const [bx0, by0] = at(-6, -6, B);
    const [bx1, by1] = at(166, 96, B);
    p.svg.append(
      s(
        "rect",
        { x: f(bx0), y: f(by0), width: f(bx1 - bx0), height: f(by1 - by0) },
        "wb-p2 wb-s wb-thin",
      ),
    );
    for (const [x, y] of [
      [-6, -6],
      [166, -6],
      [-6, 96],
      [166, 96],
    ] as const) {
      const [ex, ey] = at(x, y, B);
      line(p, x, y, ex, ey, "wb-s wb-thin");
    }
    // ceiling lights
    for (let k = 0; k < 5; k++) {
      const t = (1 - Math.pow(0.62, k + 0.6)) * B;
      const [x0, y0] = at(72, -6, t);
      const [x1] = at(88, -6, t);
      const [, y1] = at(72, 2, t);
      p.svg.append(
        path(
          `M${f(x0)} ${f(y0)}H${f(x1)}L${f(x1 - (x1 - x0) * 0.08)} ${f(y1)}H${f(x0 + (x1 - x0) * 0.08)}Z`,
          "wb-p wb-s wb-thin",
        ),
      );
    }
    // floor seams
    for (let k = 0; k < 7; k++) {
      const t = (1 - Math.pow(0.7, k + 1)) * B;
      const [x0, y0] = at(-6, 96, t);
      const [x1] = at(166, 96, t);
      line(p, x0, y0, x1, y0, "wb-s4");
    }
    // racks on both walls
    for (const side of [-1, 1] as const) {
      const wallX = side < 0 ? 6 : 154;
      for (let k = 0; k < 6; k++) {
        const tA = (1 - Math.pow(0.7, k)) * B;
        const tB = (1 - Math.pow(0.7, k + 1)) * B - 0.012;
        const [xa, ya0] = at(wallX, 8, tA);
        const [, ya1] = at(wallX, 90, tA);
        const [xb, yb0] = at(wallX, 8, tB);
        const [, yb1] = at(wallX, 90, tB);
        const quad = `M${f(xa)} ${f(ya0)}L${f(xb)} ${f(yb0)}L${f(xb)} ${f(yb1)}L${f(xa)} ${f(ya1)}Z`;
        p.svg.append(path(quad, "wb-p wb-s wb-thin"));
        if (k % 2)
          p.svg.append(
            path(quad, "", { fill: hatch(p.svg, 1.8, 90, "wb-hs3") }),
          );
        for (let j = 1; j < 8; j++) {
          const u = j / 8;
          line(p, xa, lerp(ya0, ya1, u), xb, lerp(yb0, yb1, u), "wb-s4");
          if (p.r() < 0.45)
            p.svg.append(
              s(
                "circle",
                {
                  cx: f(lerp(xa, xb, 0.18)),
                  cy: f(lerp(ya0, ya1, u) + 1.2 * (1 - tA)),
                  r: f(0.9 * (1 - tA)),
                },
                "wb-f",
              ),
            );
        }
      }
    }
    // someone at the end of the aisle
    figure(p, vx + 1, lerp(96, vy, B) - 0.2, 8.5);
  },

  health(p) {
    if (p.variant === 1) {
      ward(p);
      return;
    }
    const horizon = 70;
    skyStrokes(p, 6, 20);
    hills(p, horizon, 2);
    groundPerspective(p, horizon, 80, 16);
    p.svg.append(
      s("rect", { x: 42, y: 24, width: 70, height: 46 }, "wb-p wb-s"),
    );
    p.svg.append(path("M112 36h30v34h-30Z", "wb-p wb-s"));
    p.svg.append(
      path("M112 36h30v34h-30Z", "", { fill: hatch(p.svg, 2, 60, "wb-hs") }),
    );
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 7; col++) {
        const lit = hash32(`${row}:${col}:${p.variant}`) % 5 === 0;
        p.svg.append(
          s(
            "rect",
            { x: 47 + col * 9.4, y: 29 + row * 9.5, width: 5, height: 5.6 },
            lit ? "wb-p wb-s wb-thin" : "wb-f3",
          ),
        );
      }
    p.svg.append(path("M66 70V60h22v10", "wb-f"));
    p.svg.append(path("M62 60h30l-3-4H65Z", "wb-p wb-s"));
    p.svg.append(
      s("rect", { x: 71, y: 11, width: 12, height: 12 }, "wb-p wb-s"),
    );
    p.svg.append(path("M77 13.5v7M73.5 17h7", "wb-s wb-thick"));
    // ambulance, foreground
    const ax = 8 + p.r() * 4;
    p.svg.append(path(`M${ax} 82v-13h22l7 6v7Z`, "wb-p wb-s"));
    p.svg.append(path(`M${ax + 24} 70.5l5 4.5h-5Z`, "wb-f3"));
    p.svg.append(
      s("rect", { x: ax + 6, y: 66.6, width: 6, height: 2.4 }, "wb-f"),
    );
    p.svg.append(path(`M${ax + 9} 72v6M${ax + 6} 75h6`, "wb-s"));
    p.svg.append(s("circle", { cx: ax + 7, cy: 82.4, r: 2.6 }, "wb-f"));
    p.svg.append(s("circle", { cx: ax + 25, cy: 82.4, r: 2.6 }, "wb-f"));
    for (let i = 0; i < 6; i++)
      figure(
        p,
        92 + i * 5,
        76 - i * 0.3,
        8 - i * 0.3,
        i % 2 ? "wb-f2" : "wb-f",
      );
    tree(p, 136, 72, 22);
    tree(p, 152, 72, 17);
  },

  grid(p) {
    const horizon = 60;
    const vx = 130;
    skyStrokes(p, 6, 26, 2);
    sun(p, 62 + p.r() * 20, 16, 4.5, true);
    hills(p, horizon, 2);
    groundPerspective(p, horizon, 90, 16);
    // a town at the horizon, dark
    let x = 128;
    while (x < 168) {
      const w = 5 + p.r() * 5;
      const h = 4 + p.r() * 6;
      p.svg.append(
        path(
          `M${f(x)} ${horizon}v${f(-h)}l${f(w / 2)} -2.4l${f(w / 2)} 2.4v${f(h)}`,
          p.variant === 1 ? "wb-f2" : "wb-p wb-s wb-thin",
        ),
      );
      x += w + 1;
    }
    const pylons: { x: number; top: number; arm: number; sc: number }[] = [];
    for (let k = 0; k < 5; k++) {
      const sc = Math.pow(0.56, k);
      const px = lerp(26, vx, 1 - sc);
      const base = lerp(92, horizon, 1 - sc);
      const h = 74 * sc;
      const top = base - h;
      const w = 9 * sc;
      p.svg.append(
        path(
          `M${f(px - w)} ${f(base)}L${f(px - w * 0.18)} ${f(top)}M${f(px + w)} ${f(base)}L${f(px + w * 0.18)} ${f(top)}`,
          "wb-s",
        ),
      );
      for (let j = 0; j < 6; j++) {
        const u0 = j / 6;
        const u1 = (j + 1) / 6;
        const y0 = lerp(base, top, u0);
        const y1 = lerp(base, top, u1);
        const w0 = lerp(w, w * 0.18, u0);
        const w1 = lerp(w, w * 0.18, u1);
        p.svg.append(
          path(
            `M${f(px - w0)} ${f(y0)}L${f(px + w1)} ${f(y1)}M${f(px + w0)} ${f(y0)}L${f(px - w1)} ${f(y1)}`,
            "wb-s3",
          ),
        );
      }
      const arm = 16 * sc;
      p.svg.append(
        path(
          `M${f(px - arm)} ${f(top + 8 * sc)}H${f(px + arm)}M${f(px - arm * 0.72)} ${f(top + 16 * sc)}H${f(px + arm * 0.72)}`,
          "wb-s",
        ),
      );
      pylons.push({ x: px, top, arm, sc });
    }
    for (let k = 0; k < pylons.length - 1; k++) {
      const a = pylons[k]!;
      const b = pylons[k + 1]!;
      for (const [side, dy, reach] of [
        [-1, 8, 1],
        [1, 8, 1],
        [-1, 16, 0.72],
        [1, 16, 0.72],
      ] as const) {
        const x1 = a.x + side * a.arm * reach;
        const y1 = a.top + dy * a.sc;
        const x2 = b.x + side * b.arm * reach;
        const y2 = b.top + dy * b.sc;
        p.svg.append(
          path(
            `M${f(x1)} ${f(y1)}Q${f((x1 + x2) / 2)} ${f(Math.max(y1, y2) + 7 * a.sc)} ${f(x2)} ${f(y2)}`,
            "wb-s wb-thin wb-nofill",
          ),
        );
      }
    }
    // wires leaving the frame on the left
    const a = pylons[0]!;
    for (const [side, dy, reach] of [
      [-1, 8, 1],
      [1, 8, 1],
    ] as const)
      p.svg.append(
        path(
          `M${f(a.x + side * a.arm * reach)} ${f(a.top + dy)}Q-2 ${f(a.top + dy + 14)} -8 ${f(a.top + dy + 8)}`,
          "wb-s wb-thin wb-nofill",
        ),
      );
  },

  rail(p) {
    const horizon = 36;
    const vx = 70 + (p.r() - 0.5) * 6;
    const bx = 124 + (p.r() - 0.5) * 8;
    skyStrokes(p, 5, 22, 2);
    hills(p, horizon, 3);
    for (let x = -100; x <= 260; x += 18) line(p, vx, horizon, x, 96, "wb-s4");
    const half = (y: number) => lerp(1, 25, (y - horizon) / (96 - horizon));
    // the straight road
    p.svg.append(
      path(
        `M${f(vx - 25)} 96L${f(vx - 1)} ${horizon}M${f(vx + 25)} 96L${f(vx + 1)} ${horizon}`,
        "wb-s",
      ),
    );
    for (let k = 0; k < 16; k++) {
      const t = 1 - Math.pow(0.84, k);
      const y = lerp(96, horizon, t);
      const hw = half(y) * 1.24;
      line(p, vx - hw, y, vx + hw, y, "wb-s wb-thin");
    }
    // the branch, peeling off at the switch
    const sy = 74;
    const sh = half(sy);
    const cx = vx + 12;
    const cy = 58;
    for (const side of [-1, 1] as const)
      p.svg.append(
        path(
          `M${f(vx + side * sh)} ${sy}Q${f(cx + side * sh * 0.6)} ${cy} ${f(bx + side * 0.8)} ${horizon + 1}`,
          "wb-s wb-nofill",
        ),
      );
    for (let k = 1; k < 10; k++) {
      const u = k / 10;
      const qx = (1 - u) * (1 - u) * vx + 2 * (1 - u) * u * cx + u * u * bx;
      const qy =
        (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cy + u * u * (horizon + 1);
      const hw = half(qy) * 1.2;
      line(p, qx - hw, qy, qx + hw, qy, "wb-s wb-thin");
    }
    // the switch points
    p.svg.append(
      s("rect", { x: f(vx + sh + 3), y: sy - 2, width: 4, height: 3 }, "wb-f"),
    );
    // five on one line, one on the other
    const fy = horizon + 13;
    const fw = half(fy);
    for (let i = 0; i < 5; i++)
      figure(p, vx - fw * 0.8 + (i * fw * 1.6) / 4, fy, 7.2);
    {
      const u = 0.62;
      const qx = (1 - u) * (1 - u) * vx + 2 * (1 - u) * u * cx + u * u * bx;
      const qy =
        (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * cy + u * u * (horizon + 1);
      figure(p, qx, qy, 8.4);
    }
    // the lever, foreground
    p.svg.append(
      s("rect", { x: 8, y: 82, width: 16, height: 8, rx: 1 }, "wb-f"),
    );
    p.svg.append(path("M16 83L28 62", "wb-s wb-thick"));
    p.svg.append(s("circle", { cx: 28, cy: 62, r: 2.6 }, "wb-f"));
  },

  security(p) {
    const base = 76;
    skyStrokes(p, 4, 20, 2);
    // smoke plume
    let sx = 96 + p.r() * 10;
    let sy = 38;
    for (let i = 0; i < 9; i++) {
      const rad = 3 + i * 1.1;
      p.svg.append(
        s("circle", { cx: f(sx), cy: f(sy), r: f(rad) }, "wb-p wb-s3"),
      );
      if (i % 2 === 0)
        p.svg.append(
          s("circle", {
            cx: f(sx),
            cy: f(sy),
            r: f(rad),
            fill: hatch(p.svg, 1.9, 30, "wb-hs3"),
          }),
        );
      sx -= 4 + p.r() * 3;
      sy -= 3.2;
    }
    let x = -4;
    while (x < 164) {
      const w = 11 + p.r() * 13;
      const h = 16 + p.r() * 34;
      const top = base - h;
      p.svg.append(
        s(
          "rect",
          { x: f(x), y: f(top), width: f(w), height: f(h) },
          "wb-p wb-s",
        ),
      );
      p.svg.append(
        s("rect", {
          x: f(x + w - 3),
          y: f(top),
          width: 3,
          height: f(h),
          fill: hatch(p.svg, 1.4, 90, "wb-hs"),
        }),
      );
      for (let yy = top + 3.5; yy < base - 3; yy += 4.2)
        for (let xx = x + 2; xx < x + w - 5; xx += 3.6)
          p.svg.append(
            s(
              "rect",
              { x: f(xx), y: f(yy), width: 1.6, height: 2.2 },
              p.r() < 0.18 ? "wb-p2" : "wb-f3",
            ),
          );
      if (p.r() < 0.4)
        line(
          p,
          x + w * 0.4,
          top,
          x + w * 0.4,
          top - 6 - p.r() * 6,
          "wb-s wb-thin",
        );
      x += w + 0.8;
    }
    line(p, -4, base, 164, base, "wb-s");
    p.svg.append(
      s("rect", {
        x: -4,
        y: base,
        width: 170,
        height: 20,
        fill: hatch(p.svg, 2.2, 0, "wb-hs3"),
      }),
    );
    const drone = (cx: number, cy: number, k: number, cls = "wb-s") => {
      p.svg.append(
        path(
          `M${f(cx - k)} ${f(cy - k * 0.45)}L${f(cx + k)} ${f(cy + k * 0.45)}M${f(cx + k)} ${f(cy - k * 0.45)}L${f(cx - k)} ${f(cy + k * 0.45)}`,
          `${cls} wb-thick`,
        ),
      );
      for (const [ex, ey] of [
        [-k, -k * 0.45],
        [k, k * 0.45],
        [k, -k * 0.45],
        [-k, k * 0.45],
      ] as const)
        p.svg.append(
          s(
            "ellipse",
            {
              cx: f(cx + ex),
              cy: f(cy + ey - k * 0.18),
              rx: f(k * 0.62),
              ry: f(k * 0.16),
            },
            "wb-s wb-thin wb-nofill",
          ),
        );
      p.svg.append(
        s(
          "rect",
          {
            x: f(cx - k * 0.42),
            y: f(cy - k * 0.3),
            width: f(k * 0.84),
            height: f(k * 0.6),
            rx: f(k * 0.15),
          },
          "wb-f",
        ),
      );
      p.svg.append(
        s(
          "circle",
          { cx: f(cx), cy: f(cy + k * 0.42), r: f(k * 0.16) },
          "wb-f",
        ),
      );
    };
    for (let i = 0; i < 5; i++)
      drone(
        38 + i * 16 + (p.r() - 0.5) * 8,
        14 + p.r() * 16,
        2.2 + p.r() * 0.8,
      );
    drone(p.variant ? 44 : 118, 16, 8.5);
  },

  civic(p) {
    const horizon = 58;
    skyStrokes(p, 4, 18, 2);
    // assembly
    p.svg.append(path("M36 58V44h88v14", "wb-p wb-s"));
    p.svg.append(path("M32 44h96l-48-10Z", "wb-p wb-s"));
    for (let x = 42; x <= 118; x += 7.6) line(p, x, 45, x, 58, "wb-s wb-thin");
    p.svg.append(path("M62 34V28h36v6", "wb-p wb-s"));
    p.svg.append(path("M64 28a16 13 0 0 1 32 0", "wb-p wb-s"));
    p.svg.append(
      path("M64 28a16 13 0 0 1 16-13v13Z", "", {
        fill: hatch(p.svg, 1.6, 90, "wb-hs3"),
      }),
    );
    line(p, 80, 15, 80, 5, "wb-s wb-thin");
    p.svg.append(path("M80 5.4h8l-1.6 2.2 1.6 2.2h-8", "wb-f"));
    line(p, -4, horizon, 164, horizon, "wb-s wb-thin");
    // the crowd, three ranks
    const rank = (
      y: number,
      r: number,
      gap: number,
      cls: string,
      jitter: number,
    ) => {
      for (let x = -4; x < 166; x += gap) {
        const cx = x + (p.r() - 0.5) * jitter;
        const cy = y + (p.r() - 0.5) * jitter * 0.6;
        p.svg.append(
          path(
            `M${f(cx - r * 1.7)} ${f(cy + r * 4)}c0-${f(r * 2.2)} ${f(r * 0.7)}-${f(r * 3)} ${f(r * 1.7)}-${f(r * 3)}s${f(r * 1.7)} ${f(r * 0.8)} ${f(r * 1.7)} ${f(r * 3)}`,
            cls,
          ),
        );
        p.svg.append(s("circle", { cx: f(cx), cy: f(cy), r: f(r) }, cls));
      }
    };
    rank(61, 1.5, 3.8, "wb-p wb-s wb-thin", 1.2);
    const placard = (x: number, y: number, rot: number, w: number) => {
      const g = s("g", { transform: `rotate(${f(rot)} ${f(x)} ${f(y)})` });
      g.append(s("line", { x1: x, y1: y + 6, x2: x, y2: y + 26 }, "wb-s"));
      g.append(
        s(
          "rect",
          { x: f(x - w / 2), y: f(y - 4), width: f(w), height: f(w * 0.6) },
          "wb-p wb-s",
        ),
      );
      g.append(
        s(
          "path",
          {
            d: `M${f(x - w * 0.36)} ${f(y)}h${f(w * 0.72)}M${f(x - w * 0.36)} ${f(y + 3.4)}h${f(w * 0.4)}`,
          },
          "wb-s wb-thick",
        ),
      );
      p.svg.append(g);
    };
    rank(68, 2.4, 5.6, "wb-p wb-s", 2);
    placard(28 + p.r() * 10, 50, -8 + p.r() * 6, 18);
    placard(78 + p.r() * 8, 46, -3 + p.r() * 6, 20);
    placard(126 + p.r() * 10, 52, 3 + p.r() * 6, 16);
    rank(80, 3.8, 9.5, "wb-f", 3);
  },

  labor(p) {
    const horizon = 66;
    skyStrokes(p, 5, 18, 2);
    hills(p, horizon, 2);
    groundPerspective(p, horizon, 120, 16);
    p.svg.append(path("M14 66V40l14-8v8l14-8v8l14-8v8l14-8v34Z", "wb-p wb-s"));
    p.svg.append(
      s("rect", {
        x: 14,
        y: 44,
        width: 56,
        height: 22,
        fill: hatch(p.svg, 2, 45, "wb-hs3"),
      }),
    );
    for (let x = 18; x < 66; x += 7)
      p.svg.append(s("rect", { x, y: 46, width: 4, height: 4 }, "wb-f3"));
    p.svg.append(s("rect", { x: 34, y: 52, width: 16, height: 14 }, "wb-f"));
    for (const [cx, h] of [
      [80, 40],
      [90, 48],
    ] as const) {
      p.svg.append(
        s("rect", { x: cx - 3, y: 66 - h, width: 6, height: h }, "wb-p wb-s"),
      );
      line(p, cx - 3, 66 - h + 5, cx + 3, 66 - h + 5, "wb-s wb-thin");
    }
    // the gate, shut
    p.svg.append(path("M104 66V48h40v18M104 52h40", "wb-s"));
    for (let x = 108; x < 144; x += 4) line(p, x, 48, x, 66, "wb-s wb-thin");
    p.svg.append(
      s("rect", { x: 121.5, y: 54, width: 5, height: 4.6, rx: 0.6 }, "wb-f"),
    );
    p.svg.append(
      path("M122.4 54v-1.6a1.6 1.6 0 0 1 3.2 0V54", "wb-s wb-thin wb-nofill"),
    );
    // the queue
    for (let i = 0; i < 10; i++) {
      const t = i / 10;
      figure(
        p,
        lerp(40, 100, t),
        lerp(90, 70, t),
        lerp(15, 7, t),
        i % 3 === 1 ? "wb-f2" : "wb-f",
      );
    }
  },

  disaster(p) {
    const horizon = 50;
    p.svg.append(
      s("rect", {
        x: -4,
        y: -4,
        width: 170,
        height: 54,
        fill: hatch(p.svg, 3.2, 18, "wb-hs3"),
      }),
    );
    for (let x = -4; x < 166; x += 6 + p.r() * 6) {
      const h = 5 + p.r() * 7;
      p.svg.append(
        path(
          `M${f(x)} ${horizon}v${f(-h * 0.5)}a${f(h * 0.5)} ${f(h * 0.6)} 0 0 1 ${f(h)} 0v${f(h * 0.5)}`,
          "wb-f3",
        ),
      );
    }
    line(p, -4, horizon, 164, horizon, "wb-s wb-thin");
    const house = (x: number, y: number, w: number) => {
      p.svg.append(
        path(
          `M${f(x)} ${f(y)}V${f(y - w * 0.5)}l${f(w / 2)} ${f(-w * 0.42)}l${f(w / 2)} ${f(w * 0.42)}V${f(y)}`,
          "wb-p wb-s",
        ),
      );
      p.svg.append(
        path(
          `M${f(x + w / 2)} ${f(y - w * 0.92)}l${f(w / 2)} ${f(w * 0.42)}V${f(y)}H${f(x + w / 2)}Z`,
          "",
          { fill: hatch(p.svg, 1.6, 60) },
        ),
      );
      p.svg.append(
        s(
          "rect",
          {
            x: f(x + w * 0.16),
            y: f(y - w * 0.42),
            width: f(w * 0.2),
            height: f(w * 0.22),
          },
          "wb-f",
        ),
      );
    };
    house(44, 66, 26);
    house(96, 62, 18);
    house(128, 60, 12);
    for (let k = 0; k < 6; k++) {
      const y = 60 + k * 6;
      let d = `M-6 ${y}`;
      for (let x = -6; x < 168; x += 10)
        d += `q2.5 ${f(-1.6 - p.r() * 1.4)} 5 0t5 0`;
      p.svg.append(
        path(d, k < 2 ? "wb-s wb-nofill" : "wb-s wb-thin wb-nofill"),
      );
    }
    p.svg.append(
      s("rect", {
        x: -6,
        y: 60,
        width: 172,
        height: 40,
        fill: hatch(p.svg, 2.4, 0, "wb-hs3"),
      }),
    );
    // a leaning pole
    p.svg.append(path("M20 88L30 30M22 36h14", "wb-s"));
    p.svg.append(path("M36 36Q70 44 100 34", "wb-s wb-thin wb-nofill"));
  },

  science(p) {
    // An event display: detector rings, calorimeter segments, particle tracks.
    const cx = 80 + (p.r() - 0.5) * 8;
    const cy = 46;
    for (let x = 0; x <= 160; x += 8) line(p, x, 0, x, 90, "wb-s4");
    for (let y = 2; y <= 90; y += 8) line(p, 0, y, 160, y, "wb-s4");
    p.svg.append(s("circle", { cx: f(cx), cy, r: 40 }, "wb-p wb-s"));
    const ring = (r: number, cls: string, dash?: string) =>
      p.svg.append(
        s(
          "circle",
          { cx: f(cx), cy, r, ...(dash ? { "stroke-dasharray": dash } : {}) },
          `${cls} wb-nofill`,
        ),
      );
    ring(33, "wb-s wb-thin");
    ring(24, "wb-s3", "1.4 1.4");
    ring(12, "wb-s3");
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const len = 3 + (p.r() < 0.25 ? 3 + p.r() * 6 : p.r() * 1.5);
      const x0 = cx + Math.cos(a) * 34;
      const y0 = cy + Math.sin(a) * 34;
      p.svg.append(
        path(
          `M${f(x0)} ${f(y0)}L${f(cx + Math.cos(a) * (34 + len))} ${f(cy + Math.sin(a) * (34 + len))}`,
          len > 5 ? "wb-s wb-thick" : "wb-s wb-thin",
        ),
      );
    }
    for (let i = 0; i < 11; i++) {
      const a = p.r() * Math.PI * 2;
      const bend = (p.r() - 0.5) * 1.2;
      const r1 = 18 + p.r() * 15;
      const mx = cx + Math.cos(a + bend * 0.5) * r1 * 0.5;
      const my = cy + Math.sin(a + bend * 0.5) * r1 * 0.5;
      const ex = cx + Math.cos(a + bend) * r1;
      const ey = cy + Math.sin(a + bend) * r1;
      p.svg.append(
        path(
          `M${f(cx)} ${cy}Q${f(mx)} ${f(my)} ${f(ex)} ${f(ey)}`,
          i < 3 ? "wb-s wb-thick wb-nofill" : "wb-s wb-thin wb-nofill",
        ),
      );
    }
    p.svg.append(s("circle", { cx: f(cx), cy, r: 1.8 }, "wb-f"));
    text(p, 6, 10, `RUN ${2000 + Math.floor(p.r() * 7999)}`, "wb-num");
    text(p, 154, 10, `${(1 + p.r() * 12).toFixed(2)} TeV`, "wb-num", "end");
    text(p, 154, 86, "EVENT DISPLAY", "wb-num", "end");
  },

  food(p) {
    const vx = 76;
    const horizon = 42;
    skyStrokes(p, 4, 18, 2);
    for (let i = 0; i < 5; i++) {
      const bx = 30 + p.r() * 70;
      const by = 10 + p.r() * 14;
      p.svg.append(
        path(
          `M${f(bx - 3)} ${f(by)}q1.5-1.6 3 0q1.5-1.6 3 0`,
          "wb-s wb-thin wb-nofill",
        ),
      );
    }
    line(p, -4, horizon, 164, horizon, "wb-s");
    for (let k = -10; k <= 10; k++)
      line(
        p,
        vx + k * 2.6,
        horizon,
        vx + k * 24,
        96,
        k % 2 ? "wb-s wb-thin" : "wb-s3",
      );
    p.svg.append(path("M108 42V22h13v20M108 22a6.5 5 0 0 1 13 0", "wb-p wb-s"));
    p.svg.append(path("M121 42V30l10-7 10 7v12Z", "wb-p wb-s"));
    p.svg.append(
      path("M131 23l10 7v12h-10Z", "", { fill: hatch(p.svg, 1.6, 60) }),
    );
    p.svg.append(s("rect", { x: 127, y: 34, width: 8, height: 8 }, "wb-f"));
    for (let i = 0; i < 5; i++) {
      const x = 14 + i * 12 + p.r() * 4;
      tree(p, x, horizon, 9 + p.r() * 4);
    }
  },

  general(p) {
    skyStrokes(p, 4, 20, 2);
    sun(p, 60 + p.r() * 30, 14, 4.2, true);
    const base = 72;
    let x = -2;
    while (x < 164) {
      const w = 10 + p.r() * 15;
      const h = 14 + p.r() * 40;
      p.svg.append(
        s(
          "rect",
          { x: f(x), y: f(base - h), width: f(w), height: f(h) },
          "wb-p wb-s",
        ),
      );
      p.svg.append(
        s("rect", {
          x: f(x + w - 2.6),
          y: f(base - h),
          width: 2.6,
          height: f(h),
          fill: hatch(p.svg, 1.4, 90, "wb-hs"),
        }),
      );
      for (let yy = base - h + 4; yy < base - 4; yy += 5)
        for (let xx = x + 2.4; xx < x + w - 5; xx += 4)
          if (p.r() < 0.6)
            p.svg.append(
              s(
                "rect",
                { x: f(xx), y: f(yy), width: 1.8, height: 2.4 },
                p.r() < 0.25 ? "wb-f" : "wb-f3",
              ),
            );
      x += w + 1.4 + p.r() * 3;
    }
    line(p, -4, base, 164, base, "wb-s");
    p.svg.append(
      s("rect", {
        x: -5,
        y: base,
        width: 170,
        height: 20,
        fill: hatch(p.svg, 2.4, 30, "wb-hs3"),
      }),
    );
  },
};

const ALIASES: Record<string, string> = {
  economy: "markets",
  finance: "markets",
  money: "markets",
  prices: "markets",
  inflation: "markets",
  vc: "markets",
  ipo: "markets",
  compute: "datacenter",
  "data-center": "datacenter",
  datacentre: "datacenter",
  ai: "lab",
  research: "lab",
  tech: "lab",
  technology: "lab",
  robots: "security",
  military: "security",
  war: "security",
  drones: "security",
  cyber: "security",
  swarm: "security",
  energy: "grid",
  power: "grid",
  electricity: "grid",
  politics: "civic",
  election: "civic",
  elections: "civic",
  protest: "civic",
  unrest: "civic",
  geopolitics: "civic",
  jobs: "labor",
  unemployment: "labor",
  work: "labor",
  weather: "disaster",
  climate: "disaster",
  flood: "disaster",
  medicine: "health",
  care: "health",
  physics: "science",
  space: "science",
  transport: "rail",
  trolley: "rail",
  agriculture: "food",
  culture: "general",
  society: "general",
};

export function motifFor(topic: string): string {
  const key = topic.toLowerCase().trim();
  if (MOTIFS[key]) return key;
  return ALIASES[key] ?? "general";
}

/** Motif names, for the lab contact sheet. */
export function wireMotifs(): string[] {
  return Object.keys(MOTIFS);
}

export function thumbnail(
  topic: string,
  seed: string,
  options: { wide: boolean },
): SVGSVGElement {
  const motif = motifFor(topic);
  const svg = root(
    "0 0 160 90",
    options.wide ? 320 : 64,
    options.wide ? 180 : 64,
    "wb-thumb",
  );
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.append(s("rect", { x: -10, y: -10, width: 180, height: 110 }, "wb-p"));
  MOTIFS[motif]!({
    svg,
    r: mulberry(`${motif}:${seed}`),
    variant: hash32(`v:${seed}`) % 2,
  });
  return svg;
}
