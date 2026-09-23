import { T, p, line, circ, rect, quad, hatchQuad } from "./technical-art.ts";

function windows(
  x: number,
  y: number,
  columns: number,
  rows: number,
  w = 9,
  h = 12,
  gap = 6,
) {
  let out = "";
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      const xx = x + col * (w + gap),
        yy = y + row * (h + gap);
      out +=
        rect(xx, yy, w, h, (row + col) % 3 ? "#aeb8af" : "#e5eae2", 1.3) +
        line(xx + 2, yy + 2, xx + w - 2, yy + 2, 0.7, T.paper);
    }
  return out;
}
export function structuralArt(kind: string, variant = 0): string | null {
  const v = variant % 3;
  if (kind === "house")
    return (
      quad(
        [
          [-58, 0],
          [-58, -72],
          [25, -80],
          [61, -61],
          [61, 0],
        ],
        T.paper,
        2.8,
      ) +
      quad(
        [
          [25, -80],
          [61, -61],
          [61, 0],
          [25, 4],
        ],
        T.shade,
        2.2,
      ) +
      hatchQuad(
        [
          [28, -68],
          [57, -53],
          [57, -3],
          [28, 1],
        ],
        14,
        "#899487",
        0.9,
      ) +
      quad(
        [
          [-67, -72],
          [-18, -112],
          [33, -116],
          [70, -71],
          [25, -79],
        ],
        T.dark,
        2.7,
      ) +
      quad(
        [
          [-67, -72],
          [-18, -112],
          [25, -79],
        ],
        "#d1d6cc",
        2.2,
      ) +
      p("M-69-67L-18-104 23-73M-59-68H24M-58-42h81M-58-16h81", "none", 1.4) +
      windows(-44, -64, 3, 1, 12, 19, 8) +
      rect(-13, -32, 21, 34, T.shade, 1.8) +
      rect(-9, -28, 13, 12, T.glass, 1) +
      quad(
        [
          [-19, -34],
          [14, -35],
          [19, -29],
          [-23, -27],
        ],
        T.metal,
        1.7,
      ) +
      p("M-21-27v27M16-29v29", "none", 2.2) +
      quad(
        [
          [18, -102],
          [18, -129],
          [31, -130],
          [32, -108],
        ],
        T.metal,
        1.8,
      ) +
      line(22, -125, 29, -125, 1) +
      p("M-69 4h137M-22 5h44M-26 9h52", "none", 2) +
      line(49, -52, 49, -20, 1.5)
    );
  if (kind === "clinic")
    return (
      quad(
        [
          [-88, 1],
          [-88, -96],
          [41, -103],
          [82, -85],
          [82, 3],
        ],
        T.paper,
        2.8,
      ) +
      quad(
        [
          [41, -103],
          [82, -85],
          [82, 3],
          [41, 6],
        ],
        T.shade,
        2,
      ) +
      hatchQuad(
        [
          [45, -80],
          [77, -66],
          [77, -1],
          [45, 2],
        ],
        17,
        "#8e998d",
        0.8,
      ) +
      quad(
        [
          [-94, -96],
          [-72, -111],
          [51, -119],
          [88, -98],
          [41, -98],
        ],
        "#c5cec1",
        2.4,
      ) +
      windows(-74, -83, 5, 2, 13, 17, 10) +
      p("M-90-48h132M-87-20h128", "none", 1.5) +
      rect(-24, -41, 40, 45, T.glass, 2.2) +
      line(-4, -40, -4, 3, 1.4) +
      quad(
        [
          [-37, -44],
          [23, -46],
          [31, -38],
          [-44, -35],
        ],
        T.metal,
        1.8,
      ) +
      line(-38, -36, -38, 0, 2) +
      line(25, -40, 25, 1, 2) +
      p("M-62-99v-19M-71-109h18", "none", 3.4, T.red) +
      p("M-99 5h192M-101 10h195", "none", 1.5) +
      rect(5, -130, 28, 14, T.shade, 1.4) +
      line(10, -125, 29, -125, 1) +
      line(10, -121, 29, -121, 1)
    );
  if (kind === "server")
    return (
      quad(
        [
          [-83, 0],
          [-83, -113],
          [32, -124],
          [86, -93],
          [86, 7],
        ],
        "#d9ded6",
        3.1,
      ) +
      quad(
        [
          [32, -124],
          [86, -93],
          [86, 7],
          [32, 13],
        ],
        "#acb7aa",
        2.4,
      ) +
      hatchQuad(
        [
          [36, -108],
          [81, -84],
          [81, 3],
          [36, 8],
        ],
        22,
        "#707f71",
        1,
      ) +
      quad(
        [
          [-87, -114],
          [-59, -137],
          [42, -147],
          [90, -118],
          [32, -121],
        ],
        T.metal,
        2.6,
      ) +
      windows(-72, -103, 6, 4, 10, 14, 6) +
      p("M-83-25l113-7M-83-61l113-7", "none", 2) +
      rect(-60, -26, 23, 29, T.dark, 1.5) +
      p(
        "M-15-129v-31h18v29M-25-159H9M55-127v-31M50-158h11M-76 6L-59 3M-48 8l19-3M15 13l19-2",
        "none",
        2,
      ) +
      rect(8, -148, 25, 16, T.shade, 1.5) +
      line(11, -143, 30, -143, 1) +
      line(11, -138, 30, -138, 1) +
      p("M41-80l31 17M41-66l31 17M41-52l31 17M41-38l31 17", "none", 1.2)
    );
  if (kind === "ruin")
    return (
      quad(
        [
          [-67, 2],
          [-65, -87],
          [-49, -81],
          [-43, -107],
          [-28, -92],
          [-17, -98],
          [-6, -56],
          [16, -64],
          [11, -125],
          [28, -112],
          [32, -143],
          [59, -124],
          [66, 5],
        ],
        "#e3e1d6",
        2.8,
      ) +
      quad(
        [
          [31, -127],
          [59, -112],
          [65, 5],
          [37, 12],
        ],
        T.shade,
        2.2,
      ) +
      hatchQuad(
        [
          [36, -96],
          [57, -82],
          [63, 2],
          [40, 7],
        ],
        16,
        "#7e827a",
        1,
      ) +
      p("M-60-67h28v22h-28ZM-58-24h24v24M22-79l26 12-2 21-23-9Z", T.dark, 1.5) +
      p(
        "M-55-90l10 24-11 14M4-46l8 13-8 13M48-112l-4 19 13 9M-10-40l-15 15 8 11",
        "none",
        1.4,
      ) +
      p(
        "M-80 7l22-8 12 11 17-9 20 8 14-2 13 8 22-9 24 4M-62 16l16-3M-30 18l18 1M29 17l14-2",
        "none",
        2,
      ) +
      p("M-41-67l16 10M-41-57l16 10M-22-32l14 13M37-35l18 9", "none", 1)
    );
  if (kind === "tree") {
    if (v === 2) {
      let conifer = p("M-5 0L-3-112 4-112 7 0Z", T.shade, 2.4);
      for (let j = 0; j < 6; j++) {
        const y = -145 + j * 19,
          span = 12 + j * 7;
        conifer += p(
          `M1 ${y}l${-span} ${30 + j * 2} 9-1-5 7 15-3 5 5 8-5 15 3-5-7 9 1Z`,
          j % 2 ? "#c5d1bf" : "#e4eadc",
          2.5,
        );
        conifer += line(-span + 10, y + 28, span - 8, y + 28, 1, "#83937f");
      }
      return conifer + p("M-17 3q18-5 37 0", "none", 1.5);
    }
    let out = p(
      "M-7 1L-5-58-26-101M7 1L4-60 25-105M-4-42L-32-67M4-53L36-73",
      "none",
      3.8,
    );
    const outline =
      "M-50-65Q-70-70-64-88Q-78-102-57-115Q-57-136-32-132Q-17-156 6-142Q32-150 41-129Q65-129 64-108Q86-91 67-73Q60-51 35-58Q17-41-5-52Q-29-43-41-60Z";
    out += p(outline, "#e5eadf", 3.5);
    out += p(
      "M-64-87Q-55-77-45-78Q-48-64-26-61Q-9-49 8-62Q24-54 40-67Q59-62 65-81Q60-54 36-58Q16-42-5-52Q-31-43-41-60Q-64-63-64-87Z",
      "#bdcbb5",
      1.3,
      "#8c9b83",
    );
    out += p(
      "M-52-105q11-12 26-4q-8-21 13-24M-25-88q17-13 31 2M8-132q19 0 23 19q18-6 26 11M28-77q15-12 27-4M-39-72q9-10 22-7M5-111q14-11 29 1M-11-63q-5-14 12-17",
      "none",
      1.4,
      "#87957d",
    );
    for (let i = 0; i < 23; i++) {
      const x = -49 + ((i * 29) % 104),
        y = -115 + ((i * 17) % 53);
      out += p(
        `M${x} ${y}l3-4 4 1M${x + 2} ${y + 5}l3-3`,
        "none",
        0.85,
        "#93a18a",
      );
    }
    out += p(
      "M-4-5v-33l-7-18M2-8v-48l19-19M-5-29l-13-25M-17 3l11-4M10 3l16 2",
      "none",
      1.5,
    );
    return out;
  }
  if (kind === "bare-tree")
    return (
      p(
        "M-7 0L-4-69-19-129M7 0L3-68 15-139M-3-48L-38-85-51-119M-27-77L-29-112M-40-89l-24-9M3-62L32-91 46-132M27-86L24-115M35-100l25-13M-13-108l-20-13M11-110l23-14",
        "none",
        3.2,
      ) +
      p(
        "M-3-9v-27M2-15v-35M-46-119l-8-8M-25-111l7-13M42-131l2-10M-18 4l17-5 17 5",
        "none",
        1.1,
      )
    );
  if (kind === "column")
    return (
      quad(
        [
          [-23, 3],
          [-17, -139],
          [-7, -165],
          [11, -170],
          [22, -143],
          [31, 3],
        ],
        "#dfe6df",
        2.8,
      ) +
      quad(
        [
          [11, -170],
          [22, -143],
          [31, 3],
          [11, 7],
        ],
        "#a9b8ae",
        2,
      ) +
      p("M-9-135L-13-4M0-153V0M11-136l5 137M-29 6h64M-30 10h66", "none", 1.2) +
      circ(3, -149, 4, "#cad9c7", 1.2)
    );
  return null;
}

function cityHorizon(biome: string, stage: number) {
  const ruined = biome === "scarred" || biome === "aftermath",
    clean = biome === "pristine";
  const wall = ruined ? "#b7c1b6" : clean ? "#e2e8de" : "#ccd6c4";
  let out = "";
  for (let i = 0; i < 18; i++) {
    const x = 35 + i * 79 + (clean ? 0 : (i * 23) % 27),
      w = 48 + ((i * 19) % 37),
      h = clean ? 64 : 24 + ((i * 31) % 68),
      y = 282 - h;
    if (ruined && i % 3 === 0)
      out += p(
        `M${x} 285V${y + 11}l13-8 9 13 9-18 13 12 10-7 14 17V285Z`,
        wall,
        1,
        "#81907b",
      );
    else {
      out += rect(x, y, w, h, wall, 1);
      if (clean)
        out += p(
          `M${x} ${y}l${w * 0.25}-13 ${w * 0.5} 0 ${w * 0.25} 13`,
          "#d4dfcd",
          1,
          "#879b7e",
        );
      else if (i % 3 === 0)
        out += p(
          `M${x - 3} ${y}l${w * 0.23}-10 ${w * 0.59} 0 ${w * 0.23} 10Z`,
          "#a9b7a0",
          0.9,
          "#81907b",
        );
      else out += rect(x + 7, y - 5, w - 14, 5, "#b7c4ae", 0.7);
    }
    out += quad(
      [
        [x + w, y + 3],
        [x + w + 8, y + 9],
        [x + w + 8, 285],
        [x + w, 285],
      ],
      "#a8b59f",
      0.7,
    );
    for (let row = 0; row < Math.floor(h / 13); row++) {
      if (ruined && (row + i) % 3 === 0) continue;
      for (let col = 0; col < Math.floor(w / 12); col++)
        out += rect(
          x + 5 + col * 12,
          y + 8 + row * 13,
          5,
          5,
          ruined ? "#74806e" : "#abbba0",
          0,
        );
    }
    if (!clean && i % 4 === 0)
      out += p(
        `M${x + 12} ${y}v-15m-5 3h10M${x + w - 10} ${y}v-11`,
        "none",
        1.2,
        "#7b8d73",
      );
    if (ruined && i % 4 === 1) {
      out += p(
        `M${x + 5} ${y - 2}q-13-17 0-34q-9-19 5-27q13-5 16 7q-8 13-3 26q-13 13-6 28Z`,
        "#b1bbb0",
        0.7,
        "#a1ada0",
      );
      out += p(
        `M${x + 7} ${y + 4}l7 19-5 13M${x + w - 8} ${y + 10}l-5 16`,
        "none",
        1,
        "#7d8c74",
      );
    }
  }
  if (biome === "industrial" || biome === "lab")
    out +=
      p(
        "M18 284v-12h385v12M425 284v-16h281v16M866 284v-15h405v15",
        "none",
        3,
        "#8b9d81",
      ) +
      p(
        "M113 271v-45h16v45M110 226h22M983 268v-57h13v57M980 211h20",
        "#c2cdbb",
        1,
        "#7d9073",
      );
  return out;
}

export function backdropArt(biome: string, stage: number) {
  const late = stage >= 5,
    urban = biome !== "field" && biome !== "town";
  let body = "";
  const sky = late ? "#e1e5e1" : "#f7f6ee",
    ground = late ? "#dedfd7" : "#eeeee2";
  body +=
    rect(0, 0, 1440, 900, sky, 0) +
    circ(1147, 154, 44, late ? "#c9d1ca" : "#eeeede", 0.7, "#aeb9ac");
  body += p(
    "M0 289Q176 213 354 271Q476 223 664 273Q808 213 989 274Q1192 222 1440 268V900H0Z",
    ground,
    0.8,
    "#bec5b9",
  );
  body += p(
    "M0 287L142 244 227 257 365 278M160 266l73-10 130 34M554 274l93-28 83 17M978 271l121-32 99 20 130 22",
    "none",
    1,
    "#aeb9aa",
  );
  // Asymmetric clusters read as a distant settlement, not a row of chart bars.
  if (urban) body += cityHorizon(biome, stage);
  else
    for (let i = 0; i < 8; i++) {
      const x = 65 + i * 168,
        w = 18 + (i % 4) * 9,
        h = 9 + ((i * 13) % 23),
        y = 281 - h;
      body +=
        rect(x, y, w, h, "#d8dfd1", 0.9) +
        line(x + w, y, x + w + 6, y + 5, 0.8, "#8f9d8c") +
        line(x + w + 6, y + 5, x + w + 6, 281, 0.8, "#8f9d8c");
      body += p(
        `M${x - 3} ${y}L${x + w * 0.4} ${y - 9}L${x + w + 4} ${y}Z`,
        "#aab6a3",
        1.1,
        "#84947e",
      );
      body += rect(
        x + w * 0.18,
        y + 4,
        Math.max(3, w * 0.19),
        Math.max(3, h * 0.3),
        "#9aa991",
        0.6,
      );
      if (i % 2 === 0)
        body += p(
          `M${x + w + 12} 281v-17m-4 9q-8-5-3-11q-4-7 4-10q7-4 11 2q9 0 7 10q4 7-4 10Z`,
          "#c2cfb8",
          0.8,
          "#8c9e82",
        );
    }
  for (const [x, w] of [
    [14, 189],
    [367, 153],
    [779, 207],
    [1150, 260],
  ]) {
    body += p(
      `M${x} 287q${w * 0.09}-${8} ${w * 0.18}-3q${w * 0.09}-${11} ${w * 0.19}-3q${w * 0.09}-${6} ${w * 0.2} 1q${w * 0.09}-${9} ${w * 0.19} 1q${w * 0.09}-${7} ${w * 0.23} 4`,
      "none",
      1.2,
      "#a0ae96",
    );
  }
  body += p(
    "M0 313Q241 281 418 313T817 310T1200 312T1440 306L1440 900H0Z",
    late ? "#d5d8cc" : "#e6ebdd",
    1.2,
    "#a6b19e",
  );
  body +=
    p(
      "M0 392Q141 327 331 359Q401 371 502 392L0 608Z",
      late ? "#c3cbbd" : "#dce5d1",
      1,
      "#a6b29c",
    ) +
    p(
      "M1440 363Q1234 324 1086 370Q1025 390 918 408L1440 580Z",
      late ? "#c2cabc" : "#d9e3d0",
      1,
      "#a6b29c",
    );
  for (let i = 0; i < 58; i++) {
    const x = (i * 131) % 1440,
      y = 301 + ((i * 47) % 201),
      len = 8 + (i % 6) * 9;
    body += line(
      x,
      y,
      x + len,
      y - 2,
      late ? 0.95 : 0.8,
      late ? "#a5b09d" : "#bcc8b2",
    );
  }
  // Ribbon clouds and broad hatching, quieter than the foreground material.
  for (const [x, y, k] of [
    [150, 142, 1],
    [615, 103, 0.75],
    [1110, 113, 0.65],
  ]) {
    body += p(
      `M${x - 90 * k} ${y}q${30 * k}-${18 * k} ${53 * k}-${8 * k}q${25 * k}-${31 * k} ${56 * k}-${7 * k}q${32 * k}-${15 * k} ${70 * k} ${15 * k}Z`,
      late ? "#cbd3cc" : "#f3f4eb",
      0.9,
      "#afbcae",
    );
    body += line(x - 70 * k, y + 8, x + 102 * k, y + 8, 0.8, "#c0cbbb");
  }
  return body;
}

/** A compact, physically plausible rear window landscape. It is deliberately
 * lower contrast than the forward view and contains no reflected face. */
export function rearViewArt(stage: number, damage: number) {
  let body = p(
    "M170 158Q208 149 251 153Q294 149 348 161L342 202 169 190Z",
    "#dce2d5",
    0.7,
    "#a0ad96",
  );
  body += p("M170 158Q207 149 251 153Q293 149 348 161", "none", 1.2, "#8c9c83");
  body += p("M218 197L252 154M291 202L260 154", "none", 2.4);
  for (let i = 0; i < 6; i++) {
    const y = 163 + i * 6,
      spread = 7 + i * 5;
    body += line(256 - spread, y, 256 + spread, y + 0.8, 1.4);
  }
  body += p(
    "M185 186v-19M180 175l5-7 8 7M184 170q-14-1-9-10q-7-6 2-12q-2-7 8-8q11 0 10 8q11 5 5 13q3 9-12 9Z",
    "#c1cdba",
    1.2,
  );
  body += p(
    "M317 191v-26M311 170q-12-3-7-11q-4-9 6-12q7-6 14 0q13 3 8 12q5 8-8 12Z",
    "#c1cdba",
    1.2,
  );
  body += p("M178 183l12 1M296 176l11 1M323 188l13 1", "none", 0.9, "#96a18c");
  if (stage >= 4)
    body +=
      quad(
        [
          [205, 170],
          [205, 151],
          [218, 149],
          [224, 152],
          [224, 172],
        ],
        "#bcc9b5",
        1.2,
      ) + p("M208 155h8M208 159h8M208 163h8", "none", 0.8);
  if (damage > 0.45) body += p("M307 140l-10 18 6 11-9 22", "none", 1.7);
  return body;
}
