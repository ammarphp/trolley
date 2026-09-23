/** Original, deterministic vector drawings. No imported art or random state.
 * Coordinates are grounded at 0,0. Animation selects authored poses, never
 * interpolates limbs into rubber shapes. The renderer owns timing only. */
export type AnimalKind = "cow" | "deer" | "pig" | "dog" | "rabbit" | "sheep";
export type GlyphMood = "calm" | "alert" | "injured" | "vacant";
export type GlyphKind = AnimalKind | "person" | "robot";
export interface GlyphPose {
  frame?: number;
  mood?: GlyphMood;
  damage?: number;
  reducedGraphics?: boolean;
  variant?: number;
}
const paper = "#faf9f3",
  ink = "#272924",
  red = "#9a4e42";
const path = (d: string, fill = "none", extra = "") =>
  `<path d="${d}" fill="${fill}" ${extra}/>`;
const circle = (x: number, y: number, r: number, fill = ink) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const ellipse = (x: number, y: number, rx: number, ry: number, fill = "none") =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"/>`;

function quadrupedLegs(
  xs: number[],
  ground: number,
  frame: number,
  length: number,
) {
  const steps = [
    [-8, 8, 7, -7],
    [0, 1, -1, 0],
    [8, -8, -7, 7],
    [1, 0, 0, -1],
  ][frame % 4];
  return xs
    .map((x, i) => {
      const toe = x + steps[i],
        lift = (frame + i) % 4 === 0 ? 5 : 0,
        knee = x + steps[i] * 0.4;
      const back = i % 2 === 0;
      return (
        path(
          `M${x - 2} ${ground - length}L${knee - 2} ${ground - length * 0.45}L${toe - 2} ${ground - lift - 3}l-2 3h8l-1-4L${knee + 2} ${ground - length * 0.46}L${x + 3} ${ground - length}Z`,
          back ? "#aeb8a8" : paper,
          'stroke="#272924" stroke-width="1.7"',
        ) +
        path(
          `M${toe - 3} ${ground - lift}h7`,
          "none",
          'stroke="#272924" stroke-width="2.3"',
        )
      );
    })
    .join("");
}

export function animalPaths(kind: AnimalKind, pose: GlyphPose = {}) {
  const frame = (pose.frame || 0) % 4,
    mood = pose.mood || "calm";
  const alarm = mood === "alert",
    injured = mood === "injured";
  let body = "";
  if (kind === "cow") {
    body =
      quadrupedLegs([-32, -20, 18, 30], 0, frame, 32) +
      path(
        "M-43-34Q-49-40-46-60Q-43-71-25-71L6-69Q25-68 33-56L38-51 50-53Q61-49 61-39L58-29Q47-23 36-29L27-38Q6-26-19-30L-43-34Z",
        paper,
      ) +
      path(
        "M-46-60Q-57-64-55-43l-2 13-3 6M38-52q-6-4-5-13l9 9M50-52q9-6 11-12l1 11M38-30q7 6 17 0",
      ) +
      path(
        "M-33-69q12-3 18 5q6 5 1 15q-7 7-16 3q-13-3-11-12ZM5-68q16 0 22 12q-5 10-17 11q-12-5-9-13Z",
        ink,
      ) +
      path("M-9-31l2 8 13 1 4-10M-4-22v5M5-22v5") +
      circle(49, -44, 2.2) +
      path(
        "M57-35h-6M-41-48q6 12 17 12M-24-34q18 4 29-2M29-48l-5 10M-35-59l2 6M-5-54l-1 8",
        "none",
        'stroke="#6e7967" stroke-width="1.2"',
      );
  } else if (kind === "deer") {
    body =
      quadrupedLegs([-27, -18, 15, 23], 0, frame, 43) +
      path(
        `M-32-44Q-41-54-36-65Q-31-76-15-74L7-71Q19-68 23-64L28-${alarm ? 90 : 81}Q31-${alarm ? 106 : 97} 41-${alarm ? 110 : 99}L52-${alarm ? 108 : 97} 61-${alarm ? 100 : 89}Q65-${alarm ? 94 : 83} 56-${alarm ? 91 : 80}L45-${alarm ? 91 : 80}Q39-${alarm ? 75 : 69} 39-55L32-43Q17-35 1-40Q-16-40-32-44Z`,
        paper,
      ) +
      path(
        `M33-${alarm ? 105 : 92}l-11-13 11 4M42-${alarm ? 108 : 95}l8-15 4 15M-34-57l-12-10 4 16`,
      ) +
      circle(50, alarm ? -101 : -88, 2) +
      path(
        `M34-${alarm ? 109 : 96}l-7-17-9-7M29-${alarm ? 119 : 106}l7-12M41-${alarm ? 109 : 96}l-1-22 7-10M40-${alarm ? 124 : 111}l-10-9`,
      ) +
      path(
        "M-31-63q-4 9 4 14M-24-45q12 0 17-4M10-66q10 8 14 17M30-65l4 12M-23-62l3 1M-12-63l3 1M-1-60l3 1M-19-55l3 1M-7-53l3 1",
      );
  } else if (kind === "pig") {
    body =
      quadrupedLegs([-27, -17, 18, 28], 0, frame, 20) +
      path(
        "M-38-21Q-56-45-25-55Q10-65 35-44L49-41 53-24 37-18Q1-10-38-21Z",
        paper,
      ) +
      path("M27-43l-9-18 16 7M-46-34q-22-5-15-15q12-9 14 2q1 8-10 8") +
      ellipse(46, -29, 10, 8, paper) +
      circle(43, -29, 1.5) +
      circle(49, -29, 1.5) +
      circle(30, -37, 2) +
      path(
        "M-35-36q0-11 9-13M-23-50q19-7 35 0M28-40q-6 6-5 13M-24-23q13 4 26 0M-16-48l2 2M-5-50l2 2M6-50l2 2M17-46l2 2",
        "none",
        'stroke="#727a6c" stroke-width="1.2"',
      );
  } else if (kind === "dog") {
    body =
      quadrupedLegs([-24, -15, 17, 25], 0, frame, 28) +
      path(
        "M-31-30Q-38-40-32-51Q-22-56-8-52L11-50Q21-53 23-64Q28-71 40-68L44-58 54-53 61-50 58-42Q48-38 40-41L31-31Q20-19 10-28Q-1-24-14-30Z",
        paper,
      ) +
      path(
        `M-32-46Q-57-${frame % 2 ? 62 : 72}-48-73M25-66l-6 19 11 6 5-25Z`,
        ink,
      ) +
      circle(40, -57, 2) +
      circle(56, -46, 2) +
      path("M21-44l19 5M26-38l-1 7M47-38q5 9 9 0") +
      path("M-29-49q11-4 18 3l-4 13q-9 5-17-2Z", "#69705f") +
      path(
        "M-24-32q-8-7-5-13M19-41q5 9 0 14M-8-31q11 5 18-2M39-46l-7 7",
        "none",
        'stroke="#727a6c" stroke-width="1.2"',
      );
  } else if (kind === "rabbit") {
    const hop = [0, 7, 12, 3][frame];
    body =
      path(
        `M-24 ${-4 - hop}Q-35 ${-31 - hop}-14 ${-41 - hop}L5 ${-42 - hop}L11 ${-66 - hop}Q15 ${-73 - hop} 18 ${-63 - hop}L17 ${-41 - hop}L25 ${-61 - hop}Q31 ${-66 - hop} 30 ${-55 - hop}L25 ${-35 - hop}Q39 ${-28 - hop} 27 ${-19 - hop}L15 ${-17 - hop}L9 ${-5 - hop}Z`,
        paper,
      ) +
      ellipse(-27, -18 - hop, 7, 7, paper) +
      path(
        `M-20 ${-16 - hop}q19-16 24 1L${frame % 2 ? -9 : 7} ${-2 - hop}h-23M13 ${-17 - hop}l${frame % 2 ? 13 : 5} 12h9`,
      ) +
      circle(24, -28 - hop, 2) +
      path(
        `M30 ${-24 - hop}l9-3M30 ${-22 - hop}h10M13 ${-58 - hop}v12M-24 ${-27 - hop}q4-10 13-11M-27 ${-17 - hop}l5-3M-23 ${-11 - hop}l4-2M-11 ${-31 - hop}l4-3M-5 ${-36 - hop}l4-2`,
        "none",
        'stroke="#66715f" stroke-width="1.3"',
      );
  } else {
    body =
      quadrupedLegs([-25, -16, 17, 24], 0, frame, 20) +
      path(
        "M-34-20Q-43-27-39-35Q-46-46-35-51Q-32-59-21-57Q-12-64-3-59Q8-66 17-57Q31-60 36-49Q47-44 40-32Q43-22 31-18Q21-10 11-15Q1-9-8-15Q-20-9-26-18Q-32-15-34-20Z",
        paper,
      ) +
      path("M27-43q26-11 22 11l-9 14-10-7Z", paper) +
      circle(42, -36, 2) +
      path(
        "M33-44l-9-7M-30-41q5-6 10-1M-17-49q5-6 10-1M-9-39q6-7 12-1M7-49q5-6 10-1M18-37q6-6 11 0M-23-26q5-7 10-1M-7-22q5-7 10-1M6-29q5-6 10-1",
      );
  }
  body = `<g stroke="#272924" stroke-width="2.3">${body}</g>`;
  if (alarm) body += path("M-12-86l-2-9M-4-84l5-9");
  if (injured)
    body += pose.reducedGraphics
      ? path(
          "M-20-42l18 12M-16-47l18 12M-21-35l16 10",
          paper,
          'stroke-width="4"',
        )
      : path(
          "M-22-43l7 6-2 7 10 5M-17-42l6 12",
          "none",
          `stroke="${red}" stroke-width="4"`,
        ) + path("M-17-29v14M-10-26v6", "none", `stroke="${red}"`);
  return body;
}

export function figurePaths(kind: "person" | "robot", pose: GlyphPose = {}) {
  const f = (pose.frame || 0) % 4,
    mood = pose.mood || "calm",
    v = (pose.variant || 0) % 3;
  const step = [-5, 0, 5, 0][f];
  if (kind === "robot") {
    const left = -8 - step,
      right = 8 + step;
    return (
      path("M-9-91h19v17h-19ZM-14-69l28-1 4 34-33 1Z", "#d9dfd7") +
      path(
        `M-8-35L${left}-18 ${left - 2}-3h-9M9-35L${right}-18 ${right + 3}-3h10M-15-65l-9 21 7 18M17-64l9 20-6 18M-3-74v5M5-74v5`,
        "none",
        'stroke="#272924" stroke-width="3"',
      ) +
      path("M-6-87H7v6H-6ZM-9-60h19v10H-9ZM-8-44h17M-4-39h9", "#647268") +
      circle(left, -18, 3, paper) +
      circle(right, -18, 3, paper) +
      circle(-22, -44, 3, paper) +
      circle(24, -44, 3, paper) +
      path(
        "M-17-31l-5 9 5 5M20-31l5 8-4 5M1-91v-6M-4-97h10",
        "none",
        'stroke="#272924" stroke-width="1.8"',
      ) +
      (mood === "vacant"
        ? path("M-6-83H7", "none", 'stroke="#9a4e42" stroke-width="2"')
        : "")
    );
  }
  const lean = mood === "injured" ? 5 : 0;
  const left = -6 - step,
    right = 6 + step;
  const coat = v === 1;
  let body =
    path(
      `M-9-38L${left - 2}-18 ${left - 3}-3h-6l-1 3h13L1-26 4-1h13l-1-3h-6L${right + 3}-21 10-38Z`,
      "#a5aea2",
      'stroke="#272924" stroke-width="2.2"',
    ) +
    path(
      coat
        ? "M-10-71L-16-61-12-23 13-23 17-60 10-71Z"
        : "M-10-71L-16-61-10-38 12-38 17-60 10-71Z",
      v === 2 ? "#bbc7b5" : paper,
      'stroke="#272924" stroke-width="2.2"',
    ) +
    path("M-3-72v7h7v-7", paper, 'stroke="#272924" stroke-width="1.5"') +
    path(
      `M${-7 + lean}-84Q${-7 + lean}-94 ${1 + lean}-95Q${10 + lean}-94 ${9 + lean}-84L${7 + lean}-75Q${2 + lean}-71 ${-3 + lean}-75Z`,
      paper,
      'stroke="#272924" stroke-width="1.8"',
    ) +
    path(
      `M${-7 + lean}-85l-1-7 5-5 9 2 5 5-2 6M${7 + lean}-87l3 5-3 1`,
      "none",
      'stroke="#272924" stroke-width="1.3"',
    ) +
    path(
      "M-8-70l6 8 3-4 3 4 7-8M1-64v22M-9-56h7M5-56h7M-7-41h16",
      "none",
      'stroke="#272924" stroke-width="1.1"',
    ) +
    path(
      mood === "alert"
        ? "M-14-65L-26-56-31-73-36-71-31-46-24-43-11-56M15-65l12 14 7-19 5 3-8 27-7-1-12-15"
        : `M-13-65L${-20 + step * 0.5}-47-18-30-13-30-12-48-6-61M14-65L${22 - step * 0.5}-47 19-30 14-30 14-47 7-62`,
      paper,
      'stroke="#272924" stroke-width="2"',
    ) +
    path(
      "M-17-28l1 6 4-1v-7M16-28v6h4l1-7M-5-33l2 12M8-32l-1 11",
      "none",
      'stroke="#272924" stroke-width="1.3"',
    );
  if (v === 2)
    body += path(
      `M${-10 + lean}-90q10-13 22 0v3h-22Z`,
      "#d3dbc9",
      'stroke="#272924" stroke-width="1.4"',
    );
  if (mood === "injured")
    body += pose.reducedGraphics
      ? path(
          "M-11-58l23 9M-12-52l23 9",
          paper,
          'stroke="#737b71" stroke-width="3"',
        )
      : path(
          "M-11-58l10 5-4 10 12 5M-5-46v13",
          "none",
          `stroke="${red}" stroke-width="2.8"`,
        );
  if (mood === "vacant")
    body += path(
      `M${-5 + lean}-83h13`,
      "none",
      'stroke="#272924" stroke-width="3"',
    );
  return body;
}

export const ANIMALS: ReadonlySet<string> = new Set([
  "cow",
  "deer",
  "pig",
  "dog",
  "rabbit",
  "sheep",
]);
export const ANIMATED: ReadonlySet<string> = new Set([
  ...ANIMALS,
  "person",
  "robot",
]);
export function glyphPaths(kind: GlyphKind, pose: GlyphPose = {}) {
  return ANIMALS.has(kind)
    ? animalPaths(kind as AnimalKind, pose)
    : figurePaths(kind as "person" | "robot", pose);
}
