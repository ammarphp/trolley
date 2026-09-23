/** Original technical-ink construction. Every surface is vector geometry;
 * no raster reference, imported texture, SVG filter or hidden clipping mask. */
export const T = {
  ink: "#2a2a2a",
  paper: "#ffffff",
  metal: "#ffffff",
  shade: "#c2c2c2",
  dark: "#636363",
  glass: "#ffffff",
  red: "#a3483d",
};
const n = (value: number) => Math.round(value * 100) / 100;
export const p = (d: string, fill = "none", w = 2.4, color = T.ink) =>
  `<path d="${d}" fill="${fill}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
export const line = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w = 1.5,
  color = T.ink,
) => p(`M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`, "none", w, color);
export const circ = (
  x: number,
  y: number,
  r: number,
  fill = T.paper,
  w = 1.7,
  color = T.ink,
) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="${fill}" stroke="${color}" stroke-width="${w}"/>`;
export const rect = (
  x: number,
  y: number,
  w: number,
  h: number,
  fill = T.paper,
  stroke = 2.2,
) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${T.ink}" stroke-width="${stroke}"/>`;
export const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
export function screw(x: number, y: number, r = 4) {
  return (
    circ(x, y, r, T.metal, 1.4) +
    line(x - r * 0.5, y + r * 0.5, x + r * 0.5, y - r * 0.5, 1.2)
  );
}
export function quad(points: number[][], fill = T.metal, w = 3) {
  return p(`M${points.map((pt) => pt.map(n).join(" ")).join("L")}Z`, fill, w);
}
export function hatchQuad(
  points: number[][],
  count = 12,
  color = "#848484",
  width = 1,
) {
  const [a, b, c, d] = points;
  let body = "";
  for (let i = 1; i < count; i++) {
    const t = i / count;
    body += line(
      a[0] + (d[0] - a[0]) * t,
      a[1] + (d[1] - a[1]) * t,
      b[0] + (c[0] - b[0]) * Math.max(0, t - 0.18),
      b[1] + (c[1] - b[1]) * Math.max(0, t - 0.18),
      width,
      color,
    );
  }
  return body;
}
export function dial(cx: number, cy: number, r: number, angle: number) {
  let body =
    circ(cx + 2, cy + 3, r + 7, T.dark, 3) +
    circ(cx, cy, r + 5, T.metal, 2.2) +
    circ(cx, cy, r, T.paper, 2.2) +
    circ(cx, cy, r - 5, T.paper, 1);
  for (let i = 0; i < 19; i++) {
    const a = ((-220 + i * 14) * Math.PI) / 180;
    const outer = r - 9,
      inner = outer - (i % 3 ? 4 : 9);
    body += line(
      cx + Math.cos(a) * inner,
      cy + Math.sin(a) * inner,
      cx + Math.cos(a) * outer,
      cy + Math.sin(a) * outer,
      i % 3 ? 1.3 : 2,
    );
  }
  const a = (angle * Math.PI) / 180;
  body +=
    line(
      cx,
      cy,
      cx + Math.cos(a) * (r - 13),
      cy + Math.sin(a) * (r - 13),
      3.2,
      T.red,
    ) +
    circ(cx, cy, 4, T.ink, 1) +
    p(
      `M${cx - r * 0.55} ${cy + r * 0.5}q${r * 0.55} 8 ${r * 1.1} 0`,
      "none",
      1.3,
    );
  return body;
}

export function technicalCabinLayers() {
  const left = [
      [0, 0],
      [94, 36],
      [135, 673],
      [0, 816],
    ],
    right = [
      [1440, 0],
      [1346, 36],
      [1305, 673],
      [1440, 816],
    ];
  let frame =
    quad(
      [
        [0, 0],
        [1440, 0],
        [1400, 61],
        [40, 61],
      ],
      T.metal,
      6,
    ) +
    quad(left, T.metal, 5) +
    quad(right, T.metal, 5);
  frame +=
    quad(
      [
        [0, 0],
        [27, 11],
        [69, 687],
        [0, 759],
      ],
      T.shade,
      2.5,
    ) +
    quad(
      [
        [1413, 11],
        [1440, 0],
        [1440, 759],
        [1371, 687],
      ],
      T.shade,
      2.5,
    );
  frame +=
    hatchQuad(
      [
        [4, 52],
        [25, 56],
        [69, 684],
        [32, 720],
      ],
      24,
      "#9c9c9c",
      1.7,
    ) +
    hatchQuad(
      [
        [1415, 53],
        [1435, 54],
        [1407, 720],
        [1376, 685],
      ],
      24,
      "#9c9c9c",
      1.7,
    );
  // Three nested seals make the windshield a built object with a rebate.
  frame += p(
    "M102 637L76 113Q76 68 122 67L1318 67Q1364 68 1364 113L1338 637",
    "none",
    12,
    T.dark,
  );
  frame += p(
    "M102 637L76 113Q76 68 122 67L1318 67Q1364 68 1364 113L1338 637",
    "none",
    5.6,
  );
  frame += p(
    "M113 634L90 116Q90 81 125 81L1314 81Q1348 81 1350 116L1326 634",
    "none",
    2.2,
    T.paper,
  );
  frame += quad(
    [
      [0, 757],
      [119, 640],
      [1322, 640],
      [1440, 757],
      [1440, 900],
      [0, 900],
    ],
    T.dark,
    5,
  );
  frame += quad(
    [
      [120, 640],
      [1322, 640],
      [1250, 714],
      [192, 714],
    ],
    T.metal,
    4.5,
  );
  frame +=
    p("M124 651Q722 681 1319 651", "none", 3, T.paper) +
    p("M176 705Q720 736 1266 705", "none", 2, T.ink);
  // Recessed dimensional instrument panels, asymmetrically composed around the controller.
  frame +=
    quad(
      [
        [167, 715],
        [530, 739],
        [506, 900],
        [82, 900],
      ],
      T.metal,
      5,
    ) +
    quad(
      [
        [918, 739],
        [1274, 715],
        [1355, 900],
        [941, 900],
      ],
      T.metal,
      5,
    );
  frame +=
    quad(
      [
        [174, 728],
        [513, 750],
        [489, 895],
        [101, 895],
      ],
      "#e8e8e8",
      2.1,
    ) +
    quad(
      [
        [936, 750],
        [1260, 729],
        [1333, 895],
        [958, 895],
      ],
      "#e8e8e8",
      2.1,
    );
  frame +=
    hatchQuad(
      [
        [98, 860],
        [493, 858],
        [489, 895],
        [101, 895],
      ],
      12,
      "#b5b5b5",
      1,
    ) +
    hatchQuad(
      [
        [958, 859],
        [1313, 855],
        [1333, 895],
        [958, 895],
      ],
      12,
      "#b5b5b5",
      1,
    );
  frame +=
    quad(
      [
        [190, 737],
        [395, 752],
        [384, 857],
        [171, 846],
      ],
      T.dark,
      3.2,
    ) +
    quad(
      [
        [198, 745],
        [386, 759],
        [377, 847],
        [179, 838],
      ],
      T.metal,
      1.8,
    );
  frame += dial(245, 796, 32, -43) + dial(337, 802, 25, -128);
  frame +=
    rect(425, 768, 38, 17, T.dark, 2) +
    rect(427, 790, 34, 6, T.shade, 1.2) +
    rect(426, 803, 34, 6, T.shade, 1.2) +
    rect(425, 816, 34, 6, T.shade, 1.2);
  frame +=
    quad(
      [
        [1144, 746],
        [1237, 737],
        [1280, 852],
        [1170, 863],
      ],
      T.dark,
      3.5,
    ) +
    quad(
      [
        [1152, 754],
        [1230, 746],
        [1268, 844],
        [1176, 853],
      ],
      T.glass,
      2,
    );
  for (let i = 0; i < 7; i++)
    frame += line(
      1160 + i * 2,
      767 + i * 11,
      1235 + i * 3,
      760 + i * 11,
      1.3,
      "#9a9a9a",
    );
  frame +=
    p("M1130 704l15-28 79-7 15 28", "none", 4) +
    line(1151, 681, 1224, 676, 1.5);
  // Unlabelled task lamp, vents, screws, cable conduit and weather strips.
  frame +=
    p("M887 705L869 660Q866 641 887 636L925 635", "none", 7, T.dark) +
    p("M914 619L974 624 969 647 910 642Z", T.metal, 3.2) +
    p("M917 642l46 4", "none", 2, T.paper);
  frame +=
    p("M134 752L90 836 98 889M1307 752l44 84-8 53", "none", 7, T.dark) +
    p("M139 754L97 839 104 887M1302 754l42 85-8 48", "none", 2, T.paper);
  for (let i = 0; i < 10; i++)
    frame += line(545 + i * 9, 691, 550 + i * 9, 709, 2.4, T.dark);
  for (const [x, y] of [
    [104, 113],
    [1308, 96],
    [113, 585],
    [1323, 590],
    [166, 659],
    [1283, 659],
    [186, 729],
    [509, 752],
    [487, 883],
    [122, 881],
    [942, 752],
    [1246, 735],
    [1315, 881],
    [970, 885],
    [711, 39],
    [333, 39],
    [1107, 39],
  ])
    frame += screw(x, y, 4.5);
  // Fixed etched wear is small and does not impersonate consequence damage.
  for (let i = 0; i < 16; i++) {
    let x = 150 + ((i * 73) % 1140),
      y = 668 + (i % 3) * 4;
    frame += line(x, y, x + 12 + (i % 4) * 4, y - 2, 1, "#969696");
  }
  const controller =
    p(
      "M544 771Q505 784 486 820L455 900H835L805 819Q784 784 742 771L706 756H582Z",
      "#bebebe",
      4.9,
    ) +
    p(
      "M548 782Q579 803 644 805Q707 806 738 783L755 807Q645 835 531 807Z",
      "#dfdfdf",
      2.4,
    ) +
    p("M593 709L589 764Q643 787 699 763L692 709Z", "#e1e1e1", 3.3) +
    p(
      "M573 651Q568 691 580 721Q593 749 644 758Q691 749 706 721Q719 689 711 651Z",
      "#ebebeb",
      3.7,
    ) +
    p(
      "M575 681q-14-8-10 9q1 13 12 17M710 681q15-8 11 10q-1 13-12 16",
      "none",
      2.5,
    ) +
    p(
      "M584 721q19 12 35 13M665 734q23-2 34-12M590 727l5 16M600 732l4 14M690 730l-5 14",
      "none",
      1.2,
      "#848484",
    ) +
    p(
      "M564 657L572 622Q647 596 713 624L721 657Q646 679 564 657Z",
      "#a3a3a3",
      4.6,
    ) +
    p("M565 644Q644 665 719 645L722 661Q645 684 562 661Z", T.dark, 2.7) +
    p("M574 623Q646 647 709 626M584 619Q644 633 694 620", "none", 2.2) +
    p("M630 653h28v8h-28Z", T.metal, 1.6) +
    line(640, 654, 640, 660, 1) +
    p("M591 758Q644 781 699 758L706 774Q646 798 585 775Z", T.dark, 2.6) +
    p("M543 789l-27 16 6 12 37-19ZM744 790l25 15-6 13-36-20Z", T.metal, 2.4) +
    p(
      "M513 819Q525 845 513 886M773 819Q761 845 773 886M532 838l-9 54M755 838l10 54M573 835q73 16 142 0M570 846l-9 54M719 846l9 54M585 889h115",
      "none",
      2.1,
    ) +
    hatchQuad(
      [
        [491, 843],
        [509, 835],
        [501, 899],
        [471, 899],
      ],
      11,
      "#818181",
      1,
    ) +
    hatchQuad(
      [
        [780, 835],
        [799, 847],
        [816, 899],
        [788, 899],
      ],
      11,
      "#818181",
      1,
    ) +
    p("M607 804q31 10 70 0M533 826l15 5M740 829l14-5", "none", 1.2, T.paper);
  let mirror =
    p("M278 62l-8 40M286 63l-8 40", "none", 6, T.dark) +
    p(
      "M164 106Q164 96 178 96L355 109Q370 111 367 126L356 211Q354 224 340 222L165 210Q151 208 153 193Z",
      T.dark,
      4.5,
    ) +
    p("M169 112l186 13-11 82-177-13Z", T.glass, 2.2) +
    line(173, 116, 350, 129, 1.6, T.paper) +
    screw(162, 198, 2.4) +
    screw(359, 119, 2.4);
  return {
    frame: svg(frame),
    controller: svg(controller),
    mirror: svg(mirror),
  };
}
