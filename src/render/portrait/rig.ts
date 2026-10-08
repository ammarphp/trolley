/**
 * Who the controller is (seeded, fixed for a run) and what their face is
 * doing (derived from FaceState every rebuild).
 */
import type { FaceState } from "../api.ts";
import { createRng } from "../core/rng.ts";
import { clamp, smoothstep } from "./math.ts";

export interface Identity {
  seed: number;
  /** 0 = softer brow/jaw, 1 = heavier brow/jaw, stubble. */
  masc: number;
  jawW: number;
  chin: number;
  cheek: number;
  noseLen: number;
  noseW: number;
  /** -1 concave/snub .. +1 convex/aquiline. */
  noseBridge: number;
  noseTip: number;
  lipFull: number;
  mouthW: number;
  eyeSize: number;
  eyeSpacing: number;
  /** Canthal tilt in degrees (+ = outer corner higher). */
  eyeTilt: number;
  /** 0 = visible lid crease, 1 = hooded lids. */
  hooded: number;
  browThick: number;
  browArch: number;
  browHeight: number;
  earSize: number;
  neck: number;
  /** Hair ink density: 1 black, 0.4 light. */
  hairTone: number;
  hairCurl: number;
  /** Long hair gathered at the nape (else short back and sides). */
  longHair: boolean;
  irisTone: number;
  /** Base skin albedo. */
  skin: number;
  beard: boolean;
  /** Extra lines the sitter already had before the journey. */
  baseAge: number;
  faceLen: number;
  /** Trimmed moustache. */
  moustache: boolean;
  /** Round wire spectacles. */
  spectacles: boolean;
  /** Grey at the temples 0..1 (grows with age). */
  grey: number;
  /** A mole: face coords (x, y) or null. */
  mole: [number, number] | null;
  /** A small scar breaking one brow (side sign) or 0. */
  browScar: number;
}

export function makeIdentity(seed: number | string): Identity {
  const rng = createRng(typeof seed === "number" ? seed : `portrait:${seed}`);
  const g = (sd: number, lo = -2.2, hi = 2.2) => Math.max(lo, Math.min(hi, rng.gauss())) * sd;
  const masc = clamp(rng.chance(0.4) ? rng.range(0.05, 0.4) : rng.range(0.55, 1));
  const soft = 1 - smoothstep(0.35, 0.6, masc);
  const baseAge = clamp(rng.range(0, 0.5) * rng.range(0.3, 1));
  return {
    seed: rng.seed,
    masc,
    jawW: 1 + g(0.05) + (masc - 0.5) * 0.1 - soft * 0.06,
    chin: g(0.3) + (masc - 0.5) * 0.25 - soft * 0.15,
    cheek: 1 + g(0.12),
    noseLen: 1 + g(0.08) - soft * 0.05,
    noseW: 1 + g(0.1) + (masc - 0.5) * 0.08 - soft * 0.05,
    noseBridge: clamp(g(0.42), -0.8, 0.85),
    noseTip: g(0.28),
    lipFull: 1 + g(0.13) + soft * 0.14,
    mouthW: 1 + g(0.06),
    eyeSize: 1.08 + g(0.05) + soft * 0.03,
    eyeSpacing: 1 + g(0.04),
    eyeTilt: g(3) + soft * 1.5,
    hooded: clamp(rng.range(0, 0.8)),
    browThick: clamp(0.85 + (masc - 0.5) * 0.5 + g(0.15) - soft * 0.2, 0.42, 1.45),
    browArch: clamp(0.5 + g(0.25) + soft * 0.2, 0.05, 1),
    browHeight: g(0.16) + soft * 0.1,
    earSize: 1 + g(0.07),
    neck: 1 + (masc - 0.5) * 0.16 + g(0.03),
    hairTone: clamp(rng.range(0.5, 1)),
    hairCurl: clamp(rng.range(0, 0.7)),
    longHair: soft > 0.5 ? rng.chance(0.85) : rng.chance(0.08),
    irisTone: clamp(rng.range(0.4, 0.95)),
    skin: clamp(rng.chance(0.5) ? rng.range(0, 0.06) : rng.range(0.08, 0.22)),
    beard: masc > 0.5,
    baseAge,
    faceLen: 0.975 + g(0.035) - soft * 0.03,
    moustache: masc > 0.6 && rng.chance(0.4),
    spectacles: rng.chance(0.3),
    grey: clamp(baseAge * 1.6 - 0.2 + rng.range(-0.1, 0.2)),
    mole: rng.chance(0.55) ? [rng.range(2.2, 4.6) * (rng.chance(0.6) ? 1 : -1), rng.range(-6.5, -2.4)] : null,
    browScar: rng.chance(0.15) ? (rng.chance(0.6) ? 1 : -1) : 0,
  };
}

/** Continuous facial controls derived from FaceState. Units are cm unless noted. */
export interface Expr {
  stage: number;
  smile: number;
  frown: number;
  shock: number;
  fatigue: number;
  grief: number;
  dissoc: number;
  age: number;
  after: number;
  gloom: number;
  mouthCorner: number;
  mouthOpen: number;
  cheekRaise: number;
  browInner: number;
  browOuter: number;
  browKnit: number;
  lidUpper: number;
  lidLower: number;
  bags: number;
  nasolabial: number;
  jowl: number;
  forehead: number;
  crowFeet: number;
  stubble: number;
  tears: number;
  headPitch: number;
  headRoll: number;
  headYaw: number;
  pupil: number;
  catchlight: number;
  tension: number;
  hollow: number;
}

export function exprFromFace(f: FaceState, id: Identity): Expr {
  const smile = clamp(f.smile, 0, 1);
  const frown = clamp(-f.smile, 0, 1);
  const shock = clamp(f.shock);
  const fatigue = clamp(f.fatigue);
  const grief = clamp(f.grief);
  const dissoc = clamp(f.dissociation);
  const age = clamp(clamp(f.age) + id.baseAge * 0.5);
  const after = smoothstep(5, 6, f.stage);
  // Dissociation flattens every other expression: the face stops reporting.
  const flat = 1 - 0.6 * dissoc;
  const s = smile * (1 - shock * 0.7);
  return {
    stage: f.stage,
    smile: s,
    frown,
    shock,
    fatigue,
    grief,
    dissoc,
    age,
    after,
    gloom: clamp(0.08 + 0.22 * grief + 0.3 * fatigue + 0.3 * dissoc + 0.1 * shock),
    mouthCorner: 0.62 * s - (0.34 * frown + 0.16 * grief) * flat - 0.06 * fatigue,
    mouthOpen: 0.1 * shock + 0.12 * dissoc + 0.05 * s + 0.04 * grief,
    cheekRaise: s,
    browInner: (0.55 * grief + 0.3 * shock) * flat - 0.08 * fatigue,
    browOuter: 0.3 * shock - (0.28 * grief + 0.2 * fatigue) * flat + 0.06 * s - 0.08 * dissoc,
    browKnit: clamp((0.55 * grief + 0.35 * fatigue * (1 - dissoc) + 0.2 * shock + 0.25 * frown) * flat),
    lidUpper: clamp(1 + 0.28 * shock - 0.32 * fatigue - 0.14 * dissoc - 0.08 * grief - 0.06 * s, 0.45, 1.4),
    lidLower: 0.6 * s + 0.12 * grief * flat,
    bags: clamp(0.15 * age + 0.75 * fatigue + 0.3 * grief),
    nasolabial: clamp(0.7 * s + 0.45 * age + 0.2 * fatigue + 0.2 * grief * flat),
    jowl: clamp(0.55 * age + 0.25 * fatigue),
    forehead: clamp((0.65 * grief + 0.45 * shock) * flat + 0.3 * age),
    crowFeet: clamp(0.85 * s + 0.4 * age + 0.1 * fatigue),
    stubble: id.beard ? clamp(fatigue * 1.1 + dissoc * 0.3) : 0,
    tears: clamp((grief - 0.2) * 1.4) * (1 - 0.4 * dissoc) + 0.25 * dissoc * grief,
    headPitch: 0.06 * fatigue + 0.08 * grief * flat + 0.04 * dissoc - 0.03 * shock,
    headRoll: 0.035 + 0.05 * fatigue + 0.03 * dissoc,
    headYaw: -0.02 * dissoc,
    pupil: 0.21 + 0.06 * shock + 0.07 * dissoc + 0.02 * grief,
    catchlight: clamp(1 - 0.9 * dissoc - 0.1 * fatigue - 0.6 * after),
    // Denser hatching under strain, but never on the blank, dissociated face.
    tension: clamp(0.25 * fatigue + 0.3 * grief) * (1 - dissoc),
    hollow: clamp(0.5 * fatigue + 0.3 * dissoc + 0.3 * age),
  };
}

/** Representative FaceStates for each stage, matching the director's ranges. */
export const FACE_PRESETS: readonly FaceState[] = [
  { stage: 0, smile: 0.8, fatigue: 0.04, grief: 0, shock: 0, dissociation: 0, age: 0.04 },
  { stage: 1, smile: -0.22, fatigue: 0.2, grief: 0.04, shock: 1, dissociation: 0, age: 0.18 },
  { stage: 2, smile: -0.3, fatigue: 0.36, grief: 0.18, shock: 0, dissociation: 0.05, age: 0.34 },
  { stage: 3, smile: -0.42, fatigue: 0.62, grief: 0.34, shock: 0, dissociation: 0.12, age: 0.5 },
  { stage: 4, smile: -0.62, fatigue: 0.72, grief: 0.72, shock: 0, dissociation: 0.25, age: 0.66 },
  { stage: 5, smile: -0.5, fatigue: 0.86, grief: 0.6, shock: 0, dissociation: 0.92, age: 0.82 },
  { stage: 6, smile: -0.66, fatigue: 0.92, grief: 0.9, shock: 0, dissociation: 0.85, age: 1 },
];
