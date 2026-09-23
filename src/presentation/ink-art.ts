import { Container, Graphics } from "pixi.js";
import { technicalCabinLayers } from "./technical-art.ts";
import { structuralArt } from "./environment-art.ts";
import {
  ANIMATED,
  glyphPaths,
  type GlyphKind,
  type GlyphMood,
  type GlyphPose,
} from "./glyph-catalogue.ts";

// Original hand-authored vector geometry, licensed with this repository. Local
// coordinates are grounded at (0,0); symbols are never reconstructed per frame.
export const INK = 0x272924;
export const PAPER = 0xfaf9f3;
export const RED = 0x9a4e42;
export const GREEN = 0xe7eccf;
export type ArtKind =
  | "tree"
  | "bare-tree"
  | "cow"
  | "sheep"
  | "deer"
  | "pig"
  | "dog"
  | "rabbit"
  | "house"
  | "clinic"
  | "server"
  | "pylon"
  | "drone"
  | "flower"
  | "person"
  | "robot"
  | "ruin"
  | "column"
  | "cup"
  | "hat"
  | "umbrella"
  | "parcel";

const paths: Partial<Record<ArtKind, string>> = {
  hat: '<path fill="#faf9f3" d="M-27-23L-24-49Q0-61 24-49L27-23Q0-13-27-23Z"/><path fill="#e7eccf" d="M-27-23Q0-34 27-23L38-15Q9 5-35-10Z"/><path d="M-24-42Q0-48 24-42M-22-26Q0-32 22-26M-22-16Q0-20 26-14"/><path d="M-6-45h12v9H-6Z" fill="#272924"/><circle cy="-40" r="2" fill="#faf9f3"/>',
  umbrella:
    '<path fill="#faf9f3" d="M-40-36Q-26-72 0-75Q28-72 40-36Q27-44 16-35Q0-43-16-35Q-27-43-40-36Z"/><path d="M0-79V-7Q0 7 12 3Q18 1 15-7M0-75Q-15-63-16-35M0-75Q15-63 16-35M0-75V-39"/><path d="M-36-35l-2 5M37-35l2 5"/>',
  cup: '<path fill="#faf9f3" d="M-16-33h31l-3 28q-11 7-24 0Z"/><path d="M15-29q24-4 19 11q-3 10-21 7M-23 2q22 6 46 0M-7-42q-10-9 0-16M7-42q10-8 2-17"/><path d="M-16-32q16 5 31 0" stroke-width="1"/>',
  parcel:
    '<path fill="#faf9f3" d="M-23-43L16-48 29-36 25-4-17 0-25-10Z"/><path d="M-23-43l13 13 39-6M-10-30l-7 30M-4-46l12 12-4 31M-24-16l7 4"/><path d="M-7-22l11-1-1 11-12 1Z" fill="#e7eccf" stroke-width="1"/>',
  tree: '<path d="M-9 0L-6-50 -14-69M7 0L5-52 18-73M-5-37L-25-55M5-44L24-58"/><path fill="#faf9f3" d="M-31-48C-58-47-63-76-45-89C-54-112-25-126-10-114C5-139 33-118 30-100C58-106 67-80 47-66C48-44 23-37 8-48C-7-30-25-34-31-48Z"/><path d="M-42-74q-10-15 5-24M-20-103q14-9 21 3M18-83q17-12 25 2M-18-64q10 5 16-2" stroke-width="1.1"/><path d="M-17 1q18-5 35 1"/>',
  "bare-tree":
    '<path d="M-6 0L-4-64 -16-107M5 0L2-66 13-115M-3-50L-32-77 -39-100M-24-70L-20-93M3-57L27-82 38-106M22-78L18-97M-10-84L-28-105M9-96L28-115"/><path d="M-19 1q21-5 37 0"/>',
  cow: '<path fill="#faf9f3" d="M-42-41Q-48-70-13-68L22-64 30-54 48-49 52-27 34-22 21-33 11-24-30-25Z"/><path d="M-34-27L-35-3 -27-2 -23-27M2-25L5-3 13-3 13-28M35-46L33-61 42-54M45-49L52-61 56-53M-43-54Q-65-52-56-26"/><path fill="#272924" d="M-30-62q14-7 18 5l-5 16-19-4ZM3-54q18-10 18 9l-13 10Z"/><circle cx="43" cy="-37" r="2" fill="#272924"/><path d="M46-27l5-2M-41-2h18M4-1h13"/>',
  sheep:
    '<path fill="#faf9f3" d="M-30-15Q-45-22-35-34Q-42-47-26-47Q-25-64-10-55Q5-70 13-54Q31-62 33-44Q48-42 39-28Q40-11 24-13Q7-1-6-13Q-20-4-30-15Z"/><path d="M-24-16l-3 16M13-13l3 12M28-35q24-8 19 12l-13 4Z"/><circle cx="41" cy="-30" r="1.5" fill="#272924"/>',
  house:
    '<path fill="#faf9f3" d="M-44 0L-43-63-51-62 0-105 52-66 44-63 44 0Z"/><path d="M-43-64L0-97 44-64M-12 0v-37h24V0M-32-51h14v17h-14ZM20-51h14v17H20M-56 1h113"/><path d="M23-83v-26h10v35"/>',
  clinic:
    '<path fill="#faf9f3" d="M-62 0v-100h124V0Z"/><path d="M-67-101h134M-21 0v-43h42V0M0-43V0M-48-79h19v19h-19ZM28-79h19v19H28M-48-44h18v19h-18M30-44h18v19H30"/><path d="M0-92v31M-15-77H15" stroke="#9a4e42" stroke-width="5"/><path d="M-68 1h137"/>',
  server:
    '<path fill="#faf9f3" d="M-39 0v-145l57-5 21 14V0Z"/><path d="M18-150V0M-39-123h57M-39-99h57M-39-75h57M-39-51h57M-39-27h57M23-131l11 7M23-105l11 7M23-79l11 7M23-53l11 7"/><path d="M-30-136h22M-30-111h22M-30-87h22M-30-63h22M-30-39h22M-30-15h22" stroke-width="1"/><circle cx="8" cy="-135" r="2"/><circle cx="8" cy="-111" r="2"/><circle cx="8" cy="-87" r="2"/><circle cx="8" cy="-63" r="2"/><circle cx="8" cy="-39" r="2"/><circle cx="8" cy="-15" r="2"/>',
  pylon:
    '<path d="M-28 0L0-140 28 0M-17-54h34M-23-21h46M-11-89h22M-18-102h36M-36-82h72M-22-21L17-54-11-89M22-21L-17-54 11-89M-22-104v13M22-104v13M-40-83v14M40-83v14"/><path d="M-40-69Q-99-53-161-81M40-69Q100-49 168-80" stroke-width="1"/>',
  drone:
    '<path fill="#faf9f3" d="M-17-13L0-20 18-12 3 0Z"/><path d="M-11-14l-26-10M11-15l26-12M-4-3l-24 9M10-6l25 8"/><ellipse cx="-38" cy="-26" rx="19" ry="4"/><ellipse cx="38" cy="-28" rx="19" ry="4"/><ellipse cx="-29" cy="7" rx="17" ry="4"/><ellipse cx="36" cy="3" rx="17" ry="4"/><circle cx="2" cy="-11" r="3" fill="#9a4e42" stroke="#9a4e42"/>',
  flower:
    '<path d="M0 0L-1-22M-1-8q-17-1-9-8l9 5M0-10q13-9 12-2L0-5"/><path d="M-1-22q-14-1-8-8q-8-12 4-9q4-12 10-2q13-4 10 7q9 8-4 9q-4 10-12 3Z" fill="#e7eccf"/>',
  person:
    '<path d="M-2-40L0-19 -10-2M0-19L10-1M-2-34L-17-24 -21-31M-1-34L12-27 17-36" stroke-width="2.7"/><path fill="#faf9f3" d="M-9-62Q-3-70 5-63Q13-58 8-46Q4-38-5-42Q-13-46-9-62Z"/><path d="M-10-62q10-10 19 1M-4-48q5 4 9-1" stroke-width="1.3"/><circle cx="-3" cy="-55" r="1" fill="#272924"/><circle cx="4" cy="-55" r="1" fill="#272924"/><path d="M-5-40l6 10 4-12M-11-1h6M9 0h7" stroke-width="1.5"/>',
  robot:
    '<path fill="#faf9f3" d="M-11-60h24v20h-24ZM-9-36h20v21H-9Z"/><path d="M-2-39v3M-10-33L-21-25 -16-13M12-32L23-25 20-14M-5-15L-8-2 -16-2M7-15l5 13h8M1-61v-10"/><circle cx="1" cy="-72" r="3"/><circle cx="-4" cy="-51" r="2"/><circle cx="6" cy="-51" r="2"/><path d="M-3-44h8M-5-28H7M-5-23H7"/>',
  ruin: '<path d="M-45 0v-69l11 6 6-18 11 19 8-9L2-29 13-32 7-87 20-78 24-107 17-116 38-111 43 0"/><path d="M-48 0l9-10 9 6 8-12 6 11 9-6 12 11 12-5 8 7M-31-51l9 19-6 11M26-77l9 24-5 14"/><path d="M-62 4l14-3M42 3l16 2M-19-34h10v13" stroke-width="1"/>',
  column:
    '<path fill="#faf9f3" d="M-20 0L-13-130Q0-154 13-130L20 0Z"/><path d="M-6-120V-8M6-120V-8M-22-1h44M-15-137h30"/><circle cy="-141" r="4" fill="#e7eccf"/>',
};

const details: Partial<Record<ArtKind, string>> = {
  house:
    '<path d="M-41-57h26M16-57h27M-41-28h25M17-28h26M-40-17h25M18-17h24M-5-34v30M-30-49v13M26-49v13M-34-76l32-27M-22-67l31-28M-8-62l29-24M15-64l19-15M-49 6h99"/><path d="M-31-1v-13h8V0M29 0v-14h7V0"/>',
  clinic:
    '<path d="M-68 7h138M-58-88v-5h15M43-93h14v5M-55-55h102M-13-40v34M13-40v34M-46-35h14M31-35h14M-8-23h3M5-23h3M-56-8h25M32-8h24"/><path d="M-31-119h62v13h-62Z" fill="#faf9f3"/><path d="M-23-114h8M-9-114h8M5-114h8M19-114h5"/>',
  server:
    '<path d="M-47 2h94M-36-147l7-9 60-4 16 14v138M47-146v138M43-113h4M43-82h4M43-51h4M43-20h4M-23-123v10M-23-99v10M-23-75v10M-23-51v10M-23-27v10"/><path d="M-31-132h18M-31-108h18M-31-84h18M-31-60h18M-31-36h18M-31-12h18"/>',
  pylon:
    '<path d="M-29 5h58M-16-49L14-26M16-49L-14-26M-10-87L8-60M10-87L-8-60M-20-97h40M-39-77h78M-43-66v-5M-37-66v-5M37-66v-5M43-66v-5"/>',
  tree: '<path d="M-3-5v-25M2-3v-17M-32-82l9 2M-20-93l6 2M12-111l7 5M25-91l9 3M-16-52l5 3M31-58l7-5M-19 4l-12 2M25 4l11 2"/>',
  "bare-tree":
    '<path d="M-2-8v-30M3-11v-13M-34-76l7 4M25-84l8-1M-23-102l8 3M-13 4h27"/>',
  ruin: '<path d="M-56 7l18-4 10 6 17-2 8 4M20 9l13-4 8 3 15-3M-38-61l11 8M-36-47l12 8M28-42l11 4M24-28l14 7M-16-18l9 4M-4-5l5 6"/>',
  column:
    '<path d="M-24 4h48M-23 8h46M-10-124v109M10-124v109M-8-130h16M-11-8h22"/>',
  drone:
    '<path d="M-7-12l8 6 8-6M-5-3v8h9V2M-44-26h12M32-28h12M-35 7h12M30 3h12"/>',
};

function damagePaths(kind: ArtKind, pose: GlyphPose) {
  if (
    (pose.damage || 0) < 0.25 ||
    !["house", "clinic", "server", "column", "ruin"].includes(kind)
  )
    return "";
  const deep = (pose.damage || 0) > 0.65;
  return (
    '<path d="M-19-70l9 12-6 16 12 12M-10-58l13-4M23-31l-8 9 8 12" stroke-width="2.6"/>' +
    (deep
      ? '<path d="M-25-39l18 11M-25-28l18-11M17-76l14 14M17-62l14-14" stroke-width="4"/><path d="M-31 6l10-6 8 9M17 5l8-8 10 9"/>'
      : "")
  );
}

export function artSvg(kind: ArtKind, pose: GlyphPose = {}): string {
  const body = ANIMATED.has(kind)
    ? glyphPaths(kind as GlyphKind, pose)
    : (structuralArt(kind, pose.variant || 0) ??
        (paths[kind] || "") + (details[kind] || "")) + damagePaths(kind, pose);
  return `<svg xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#272924" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}
export function makeArt(kind: ArtKind, pose: GlyphPose = {}) {
  return new Graphics().svg(artSvg(kind, pose));
}

/** Four pre-authored poses per moving glyph; no SVG reparsing inside animation. */
export class InkGlyph extends Container {
  private poses: Graphics[] = [];
  private stateKey = "";
  private selected = -1;
  readonly kind: ArtKind;
  readonly variant: number;
  constructor(kind: ArtKind, variant = 0) {
    super();
    this.kind = kind;
    this.variant = variant;
    this.eventMode = "none";
  }
  setState(mood: GlyphMood, damage: number, reducedGraphics: boolean) {
    const key = `${mood}:${Math.floor(damage * 4)}:${reducedGraphics}`;
    if (key === this.stateKey) return;
    this.stateKey = key;
    for (const frame of this.poses) {
      this.removeChild(frame);
      frame.destroy();
    }
    this.poses = Array.from(
      { length: ANIMATED.has(this.kind) ? 4 : 1 },
      (_, frame) =>
        makeArt(this.kind, {
          frame,
          mood,
          damage,
          reducedGraphics,
          variant: this.variant,
        }),
    );
    this.addChild(...this.poses);
    this.selected = -1;
    this.showFrame(0);
  }
  showFrame(frame: number) {
    const next =
      ((frame % this.poses.length) + this.poses.length) % this.poses.length;
    if (next === this.selected) return;
    this.selected = next;
    this.poses.forEach((pose, i) => {
      pose.visible = i === next;
    });
  }
}

export function cabinLayers() {
  return technicalCabinLayers();
}
export function cabinSvg() {
  const parts = technicalCabinLayers();
  return `<svg xmlns="http://www.w3.org/2000/svg">${Object.values(parts)
    .map((source) => source.replace(/<\/?svg[^>]*>/g, ""))
    .join("")}</svg>`;
}
