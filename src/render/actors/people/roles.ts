/**
 * Role wardrobes: who each PersonRole is, drawn as a specific silhouette.
 *
 * Pigment is spent only where it means something: amber on hi-vis and crew
 * coveralls (the people the trolley is pointed at), signal red on a named
 * worker's scarf and a station lamp lens. Everything else is paper, grey and
 * ink, with seeded variety in build, hair, headwear and colourway.
 */
import type { PersonRole, Pose } from "../../api.ts";
import type { Rng } from "../../core/rng.ts";
import type { AgeClass } from "./anatomy.ts";
import type { HeldProp } from "./props.ts";
import type { Extra, FacialHair, HairStyle, Outfit } from "./tailor.ts";

export type StandStyle = "hang" | "pockets" | "crossed" | "behind" | "hips" | "hold";
export type WorkKind = "swing" | "dig" | "tend" | "write" | "lift" | "scan";

export interface RoleSpec {
  age: AgeClass;
  fem?: number;
  outfit: Outfit;
  stand: StandStyle;
  /** What the hands carry when idle (stand, walk, queue, watch, point). */
  idle: { right: HeldProp | null; left: HeldProp | null };
  /** Tool used by the work pose. */
  tool: HeldProp | null;
  work: WorkKind;
  /** Placard, box or bundle carried by the carry pose. */
  carry: HeldProp;
}

/**
 * Garment tone steps. Lit vertical cloth gains ~0.1 from shading, so these
 * sit a notch lighter than the core TONE names: "mid" trousers read as one
 * family of strokes in the light and cross-hatch only in shadow. Blacks are
 * spent as solid fills (hair, shoes, a black coat), not as dense hatching.
 */
const T = { paper: 0, pale: 0.08, light: 0.18, mid: 0.28, dark: 0.4, deep: 0.55, solid: 1 } as const;

function skinTone(rng: Rng): number {
  return rng.pick([0, 0, 0, 0.05, 0.1, 0.16, 0.22]);
}
function hairTone(rng: Rng, age: AgeClass): number {
  if (age === "elder") return rng.pick([T.pale, T.light, T.light, T.mid, T.paper]);
  return rng.pick([T.solid, T.solid, T.solid, T.deep, T.dark, T.mid, T.pale]);
}
function hairStyle(rng: Rng, fem: number, age: AgeClass): HairStyle {
  if (age === "elder") return fem > 0.5 ? rng.pick(["short", "bun", "curly", "short"] as const) : rng.pick(["receding", "bald", "short", "receding", "crop"] as const);
  if (age === "child") return fem > 0.5 ? rng.pick(["ponytail", "long", "bun", "short", "curly"] as const) : rng.pick(["crop", "short", "curly", "buzz"] as const);
  return fem > 0.5
    ? rng.pick(["long", "bun", "ponytail", "short", "curly", "bun", "long"] as const)
    : rng.pick(["crop", "short", "buzz", "curly", "receding", "crop", "bald", "short"] as const);
}
function facial(rng: Rng, fem: number, age: AgeClass): FacialHair {
  if (fem > 0.5 || age === "child") return "none";
  return rng.pick(["none", "none", "none", "beard", "moustache", "stubble", "none"] as const);
}

function base(rng: Rng, fem: number, age: AgeClass): Outfit {
  return {
    skin: skinTone(rng),
    hair: hairStyle(rng, fem, age),
    hairTone: hairTone(rng, age),
    facial: facial(rng, fem, age),
    hat: "none",
    hatTone: T.mid,
    top: "shirt",
    topTone: T.paper,
    sleeves: "long",
    shirtTone: T.paper,
    hem: null,
    open: 0,
    legs: "trousers",
    legTone: T.mid,
    feet: "shoes",
    feetTone: T.solid,
    over: "none",
    overTone: T.paper,
    extras: [],
    tieTone: T.deep,
    bagTone: T.dark,
  };
}

/** Decide sex/age for a role before the body is drawn. */
export function roleDemographics(role: PersonRole, rng: Rng): { age: AgeClass; fem: number } {
  const age: AgeClass = role === "child" ? "child" : role === "elder" ? "elder" : "adult";
  const femChance: Record<PersonRole, number> = {
    worker: 0.18,
    crew: 0.2,
    civilian: 0.5,
    commuter: 0.45,
    child: 0.5,
    elder: 0.55,
    nurse: 0.7,
    doctor: 0.45,
    patient: 0.5,
    paramedic: 0.4,
    engineer: 0.3,
    official: 0.4,
    executive: 0.3,
    inspector: 0.3,
    researcher: 0.45,
    soldier: 0.12,
    police: 0.3,
    protester: 0.5,
    farmer: 0.3,
    student: 0.5,
    stationmaster: 0.15,
    passenger: 0.5,
    refugee: 0.55,
    volunteer: 0.55,
  };
  const fem = rng.chance(femChance[role]) ? rng.range(0.75, 1) : rng.range(0, 0.2);
  return { age, fem };
}

export function roleSpec(role: PersonRole, rng: Rng, fem: number, age: AgeClass, named: boolean): RoleSpec {
  const o = base(rng, fem, age);
  let stand: StandStyle = rng.pick(["hang", "hang", "pockets", "behind", "crossed"] as const);
  let idle: RoleSpec["idle"] = { right: null, left: null };
  let tool: HeldProp | null = null;
  let work: WorkKind = "lift";
  let carry: HeldProp = "box";
  const ex: Extra[] = [];
  const f = fem > 0.5;
  switch (role) {
    case "worker": {
      o.hat = "hardhat";
      const amberHat = rng.chance(0.45);
      o.hatTone = amberHat ? T.paper : T.paper;
      o.hatAccent = amberHat ? "amber" : undefined;
      o.top = "shirt";
      o.topTone = rng.pick([T.pale, T.light, T.paper]);
      o.sleeves = rng.pick(["rolled", "long", "long"] as const);
      o.over = "hivis";
      o.overTone = T.paper;
      o.overAccent = "amber";
      o.legs = rng.chance(0.5) ? "cargo" : "trousers";
      o.legTone = rng.pick([T.light, T.mid, T.solid]);
      o.feet = "boots";
      o.feetTone = T.deep;
      if (rng.chance(0.5)) ex.push("gloves");
      if (rng.chance(0.35)) ex.push("toolbelt");
      if (named) ex.push("redscarf");
      stand = rng.pick(["hips", "hang", "crossed", "hips"] as const);
      tool = rng.pick(["sledge", "pick", "sledge"] as const);
      work = "swing";
      carry = "toolbox";
      break;
    }
    case "crew": {
      o.hat = rng.chance(0.6) ? "hardhat" : "beanie";
      o.hatTone = o.hat === "hardhat" ? T.paper : T.deep;
      o.top = "coverall";
      o.topTone = T.paper;
      o.topAccent = "amber";
      o.topAmount = 0.88;
      o.sleeves = rng.chance(0.3) ? "rolled" : "long";
      o.legs = "trousers";
      o.feet = "boots";
      o.feetTone = T.deep;
      ex.push("bands", "toolbelt");
      if (rng.chance(0.6)) ex.push("gloves");
      if (named) ex.push("redscarf");
      stand = rng.pick(["hips", "hang", "crossed"] as const);
      tool = "shovel";
      work = "dig";
      carry = "toolbox";
      break;
    }
    case "civilian": {
      const kind = f ? rng.pick(["dress", "jumper", "cardigan", "tee", "shirt"] as const) : rng.pick(["jumper", "tee", "shirt", "jacket", "cardigan"] as const);
      o.top = kind;
      o.topTone = rng.pick([T.paper, T.pale, T.light, T.mid, T.dark]);
      o.shirtTone = T.paper;
      o.sleeves = kind === "tee" ? "short" : rng.chance(0.25) ? "rolled" : "long";
      if (kind === "dress") {
        o.hem = null;
        o.legs = "skirt";
        o.legTone = o.topTone;
        o.feet = rng.pick(["shoes", "trainers"] as const);
      } else {
        o.legs = f && rng.chance(0.35) ? "skirt" : rng.pick(["jeans", "trousers", "jeans"] as const);
        o.legTone = rng.pick([T.light, T.mid, T.light, T.solid]);
        o.feet = rng.pick(["trainers", "shoes", "shoes"] as const);
      }
      o.feetTone = o.feet === "trainers" ? T.paper : T.solid;
      if (rng.chance(0.25)) ex.push("shoulderBag");
      if (rng.chance(0.15)) {
        o.hat = rng.pick(["flatcap", "beanie", "trilby"] as const);
        o.hatTone = rng.pick([T.mid, T.dark, T.deep]);
      }
      carry = rng.pick(["box", "bundle"] as const);
      break;
    }
    case "commuter": {
      o.top = "coat";
      o.topTone = rng.pick([T.mid, T.solid, T.light, T.dark]);
      o.hem = rng.range(0.42, 0.55);
      o.shirtTone = T.paper;
      if (!f && rng.chance(0.6)) ex.push("tie");
      o.tieTone = rng.pick([T.deep, T.mid, T.solid]);
      o.legs = f && rng.chance(0.3) ? "skirt" : "trousers";
      o.legTone = rng.pick([T.mid, T.solid, T.light]);
      o.feet = "shoes";
      if (rng.chance(0.5)) ex.push("scarf");
      if (rng.chance(0.3)) {
        o.hat = rng.pick(["trilby", "flatcap", "beanie"] as const);
        o.hatTone = rng.pick([T.dark, T.deep, T.mid]);
      }
      const bag = rng.pick(["briefcase", "umbrella", "shoulder"] as const);
      if (bag === "shoulder") ex.push("shoulderBag");
      else idle = { right: bag, left: null };
      o.bagTone = T.deep;
      stand = bag === "shoulder" ? rng.pick(["pockets", "hang"] as const) : "hold";
      carry = "box";
      break;
    }
    case "child": {
      const kind = rng.pick(f ? (["dress", "jumper", "raincoat", "tee"] as const) : (["jumper", "tee", "raincoat", "hoodie"] as const));
      o.top = kind;
      o.topTone = rng.pick([T.paper, T.pale, T.light, T.mid, T.dark]);
      o.sleeves = kind === "tee" ? "short" : "long";
      if (kind === "dress") {
        o.legs = "skirt";
        o.legTone = o.topTone;
      } else o.legs = rng.pick(["shorts", "trousers", "jeans", "shorts"] as const);
      o.legTone = kind === "dress" ? o.topTone : rng.pick([T.light, T.mid, T.solid]);
      o.feet = rng.pick(["trainers", "wellies", "shoes"] as const);
      o.feetTone = o.feet === "trainers" ? T.paper : o.feet === "wellies" ? T.deep : T.solid;
      if (kind === "raincoat" && rng.chance(0.5)) ex.push("hoodDown");
      if (rng.chance(0.4)) ex.push("backpack");
      o.bagTone = rng.pick([T.mid, T.dark, T.light]);
      if (rng.chance(0.35)) idle = { right: null, left: "teddy" };
      stand = rng.pick(["hang", "hang", "behind"] as const);
      carry = "teddy";
      break;
    }
    case "elder": {
      o.top = rng.pick(["cardigan", "coat", "cardigan", "jumper"] as const);
      o.topTone = rng.pick([T.light, T.mid, T.pale, T.dark]);
      if (o.top === "coat") o.hem = rng.range(0.38, 0.48);
      o.shirtTone = T.paper;
      o.legs = f && rng.chance(0.5) ? "skirt" : "trousers";
      o.legTone = rng.pick([T.light, T.mid, T.light]);
      o.feet = "shoes";
      if (rng.chance(0.55)) ex.push("glasses");
      if (f && rng.chance(0.35)) {
        o.hat = "headscarf";
        o.hatTone = rng.pick([T.light, T.mid, T.pale]);
      } else if (!f && rng.chance(0.55)) {
        o.hat = "flatcap";
        o.hatTone = rng.pick([T.mid, T.dark, T.light]);
      }
      idle = rng.chance(0.65) ? { right: "cane", left: null } : { right: null, left: null };
      stand = idle.right ? "hold" : rng.pick(["behind", "hang"] as const);
      carry = "bundle";
      break;
    }
    case "nurse": {
      o.top = "scrubs";
      o.topTone = rng.pick([T.pale, T.light, T.pale]);
      o.sleeves = "short";
      o.legs = "trousers";
      o.legTone = o.topTone;
      o.feet = "clogs";
      o.feetTone = T.paper;
      if (o.hair === "long") o.hair = "bun";
      ex.push("fobwatch");
      if (rng.chance(0.6)) ex.push("lanyard");
      stand = rng.pick(["hang", "behind", "crossed"] as const);
      work = "tend";
      carry = "box";
      break;
    }
    case "doctor": {
      o.top = "labcoat";
      o.topTone = T.paper;
      o.hem = rng.range(0.5, 0.58);
      o.open = rng.range(0.3, 0.9);
      o.shirtTone = rng.pick([T.pale, T.paper, T.light]);
      if (rng.chance(0.55)) ex.push("tie");
      o.tieTone = rng.pick([T.deep, T.mid]);
      o.legTone = rng.pick([T.light, T.mid, T.solid]);
      o.feet = "shoes";
      ex.push("stethoscope", "badge");
      if (rng.chance(0.3)) ex.push("glasses");
      stand = rng.pick(["pockets", "hang", "crossed", "hold"] as const);
      idle = stand === "hold" ? { right: null, left: "clipboard" } : idle;
      work = "tend";
      carry = "box";
      break;
    }
    case "patient": {
      o.top = "gown";
      o.topTone = T.paper;
      o.sleeves = "short";
      o.hem = rng.range(0.44, 0.52);
      o.legs = "bare";
      o.feet = "slippers";
      o.feetTone = T.pale;
      o.hat = "none";
      ex.push("wristband");
      idle = rng.chance(0.5) ? { right: null, left: "iv-pole" } : idle;
      stand = idle.left ? "hold" : rng.pick(["hang", "crossed"] as const);
      carry = "bundle";
      break;
    }
    case "paramedic": {
      o.top = "coverall";
      o.topTone = T.deep;
      o.sleeves = "long";
      o.feet = "boots";
      o.feetTone = T.solid;
      ex.push("bands", "epaulettes", "radio", "gloves");
      idle = { right: "medic-bag", left: null };
      stand = "hold";
      work = "tend";
      carry = "medic-bag";
      break;
    }
    case "engineer": {
      o.top = "shirt";
      o.topTone = rng.pick([T.pale, T.paper, T.light]);
      o.sleeves = rng.pick(["rolled", "long"] as const);
      o.over = "bib";
      o.overTone = rng.pick([T.light, T.mid, T.pale]);
      o.legs = "trousers";
      o.legTone = o.overTone;
      o.feet = "boots";
      o.feetTone = T.deep;
      ex.push("earDefenders", "glasses");
      if (rng.chance(0.4)) {
        o.hat = "hardhat";
        o.hatTone = T.paper;
      }
      idle = { right: null, left: "clipboard" };
      stand = "hold";
      tool = "clipboard";
      work = "write";
      carry = "toolbox";
      break;
    }
    case "official": {
      o.top = "suit";
      o.topTone = rng.pick([T.mid, T.dark, T.light]);
      o.shirtTone = T.paper;
      ex.push("tie", "lanyard");
      o.tieTone = rng.pick([T.deep, T.solid, T.mid]);
      o.legTone = o.topTone;
      o.legs = f && rng.chance(0.4) ? "skirt" : "trousers";
      o.feet = "shoes";
      idle = { right: null, left: "folder" };
      stand = rng.pick(["hold", "behind", "crossed"] as const);
      if (stand !== "hold") idle = { right: null, left: null };
      tool = "clipboard";
      work = "write";
      carry = "box";
      break;
    }
    case "executive": {
      o.top = "suit";
      o.topTone = rng.pick([T.deep, T.solid, T.dark]);
      o.shirtTone = T.paper;
      if (rng.chance(0.7)) ex.push("tie");
      o.tieTone = rng.pick([T.solid, T.mid]);
      if (rng.chance(0.5)) ex.push("pocketSquare");
      o.legTone = o.topTone;
      o.legs = f && rng.chance(0.3) ? "skirt" : "trousers";
      o.feet = "shoes";
      o.feetTone = T.solid;
      if (o.hair === "curly" || o.hair === "long") o.hair = f ? "bun" : "short";
      o.facial = "none";
      idle = rng.chance(0.5) ? { right: "briefcase", left: null } : idle;
      stand = idle.right ? "hold" : rng.pick(["pockets", "crossed", "behind"] as const);
      tool = "tablet";
      work = "write";
      carry = "box";
      break;
    }
    case "inspector": {
      o.top = "trench";
      o.topTone = rng.pick([T.light, T.pale, T.mid]);
      o.hem = rng.range(0.44, 0.52);
      o.shirtTone = T.paper;
      ex.push("tie");
      o.tieTone = T.deep;
      o.legTone = rng.pick([T.mid, T.light]);
      o.feet = "shoes";
      o.hat = rng.chance(0.7) ? "trilby" : "none";
      o.hatTone = rng.pick([T.dark, T.mid, T.deep]);
      idle = { right: null, left: "clipboard" };
      stand = rng.pick(["hold", "behind"] as const);
      if (stand === "behind") idle = { right: null, left: null };
      tool = "clipboard";
      work = "write";
      carry = "box";
      break;
    }
    case "researcher": {
      o.top = "labcoat";
      o.topTone = T.paper;
      o.hem = rng.range(0.52, 0.6);
      o.open = rng.range(0.1, 0.7);
      o.shirtTone = rng.pick([T.mid, T.dark, T.light, T.pale]);
      o.legTone = rng.pick([T.light, T.mid, T.solid]);
      o.feet = rng.pick(["trainers", "shoes"] as const);
      o.feetTone = o.feet === "trainers" ? T.paper : T.solid;
      ex.push("badge", rng.chance(0.5) ? "goggles" : "glasses");
      idle = rng.chance(0.55) ? { right: null, left: "tablet" } : idle;
      stand = idle.left ? "hold" : rng.pick(["pockets", "crossed"] as const);
      tool = "tablet";
      work = "write";
      carry = "box";
      break;
    }
    case "soldier": {
      o.hat = "helmet";
      o.hatTone = rng.pick([T.mid, T.light]);
      o.top = "fatigue";
      o.topTone = rng.pick([T.light, T.mid]);
      o.over = "plate";
      o.overTone = rng.pick([T.mid, T.dark]);
      o.legs = "cargo";
      o.legTone = o.topTone;
      o.feet = "boots";
      o.feetTone = T.deep;
      o.facial = "none";
      ex.push("kneepads", "gloves");
      if (rng.chance(0.4)) ex.push("backpack");
      o.bagTone = T.mid;
      idle = { right: "rifle", left: null };
      stand = "hold";
      tool = "rifle";
      work = "scan";
      carry = "crate";
      break;
    }
    case "police": {
      o.hat = rng.chance(0.75) ? "peaked" : "none";
      o.hatTone = T.deep;
      o.top = "jacket";
      o.topTone = T.dark;
      o.over = "stab";
      o.overTone = T.solid;
      o.legTone = T.dark;
      o.feet = "boots";
      o.feetTone = T.solid;
      ex.push("radio", "belt", "epaulettes");
      stand = rng.pick(["hips", "behind", "hang"] as const);
      idle = rng.chance(0.3) ? { right: "baton", left: null } : idle;
      if (idle.right) stand = "hold";
      tool = null;
      work = "scan";
      carry = "box";
      break;
    }
    case "protester": {
      o.top = rng.pick(["hoodie", "jacket", "raincoat", "jumper"] as const);
      o.topTone = rng.pick([T.dark, T.mid, T.deep, T.light]);
      o.legs = rng.pick(["jeans", "jeans", "trousers"] as const);
      o.legTone = rng.pick([T.light, T.mid, T.solid]);
      o.feet = rng.pick(["trainers", "boots"] as const);
      o.feetTone = o.feet === "trainers" ? T.paper : T.deep;
      const head = rng.pick(["beanie", "hood", "none", "none"] as const);
      o.hat = head;
      o.hatTone = head === "hood" ? o.topTone : rng.pick([T.deep, T.mid]);
      if (o.top === "hoodie" && head !== "hood") ex.push("hoodDown");
      if (rng.chance(0.3)) ex.push("mask");
      if (rng.chance(0.4)) ex.push("backpack");
      o.bagTone = T.mid;
      idle = { right: "sign", left: null };
      stand = "hold";
      carry = "sign";
      break;
    }
    case "farmer": {
      o.hat = rng.pick(["flatcap", "straw", "flatcap", "none"] as const);
      o.hatTone = o.hat === "straw" ? T.pale : rng.pick([T.mid, T.dark]);
      o.top = "shirt";
      o.topTone = rng.pick([T.pale, T.light, T.paper]);
      o.sleeves = "rolled";
      o.over = "bib";
      o.overTone = rng.pick([T.mid, T.dark]);
      o.legTone = o.overTone;
      o.feet = "wellies";
      o.feetTone = T.deep;
      stand = rng.pick(["pockets", "hang", "crossed"] as const);
      tool = "fork";
      work = "dig";
      carry = "crate";
      break;
    }
    case "student": {
      o.top = rng.pick(["hoodie", "jumper", "tee", "jacket"] as const);
      o.topTone = rng.pick([T.mid, T.dark, T.light, T.pale]);
      o.sleeves = o.top === "tee" ? "short" : "long";
      if (o.top === "hoodie") ex.push("hoodDown");
      o.legs = "jeans";
      o.legTone = rng.pick([T.light, T.mid]);
      o.feet = "trainers";
      o.feetTone = T.paper;
      ex.push("backpack");
      if (rng.chance(0.3)) ex.push("headphones");
      o.bagTone = rng.pick([T.dark, T.mid, T.deep]);
      stand = rng.pick(["pockets", "hang", "crossed"] as const);
      tool = "tablet";
      work = "write";
      carry = "box";
      break;
    }
    case "stationmaster": {
      o.hat = "peaked";
      o.hatTone = T.solid;
      o.top = "frock";
      o.topTone = T.solid;
      o.hem = rng.range(0.52, 0.6);
      o.shirtTone = T.paper;
      ex.push("tie", "watchchain", "epaulettes");
      o.tieTone = T.solid;
      o.legTone = T.solid;
      o.feet = "shoes";
      if (!f && rng.chance(0.6)) o.facial = rng.pick(["moustache", "beard"] as const);
      idle = { right: "lamp", left: null };
      stand = "hold";
      tool = "lamp";
      work = "scan";
      carry = "lamp";
      break;
    }
    case "passenger": {
      o.top = rng.pick(["coat", "jacket", "raincoat", "cardigan"] as const);
      o.topTone = rng.pick([T.light, T.mid, T.dark, T.pale]);
      if (o.top === "coat") o.hem = rng.range(0.42, 0.55);
      o.shirtTone = T.paper;
      o.legs = f && rng.chance(0.4) ? "skirt" : "trousers";
      o.legTone = rng.pick([T.light, T.mid, T.solid]);
      o.feet = "shoes";
      if (rng.chance(0.35)) {
        o.hat = rng.pick(["trilby", "flatcap"] as const);
        o.hatTone = rng.pick([T.mid, T.dark]);
      }
      idle = { right: "suitcase", left: null };
      stand = "hold";
      carry = "suitcase";
      break;
    }
    case "refugee": {
      o.top = rng.pick(["jacket", "jumper", "coat"] as const);
      o.topTone = rng.pick([T.mid, T.dark, T.light]);
      if (o.top === "coat") o.hem = rng.range(0.4, 0.5);
      o.over = "blanket";
      o.overTone = rng.pick([T.light, T.pale, T.mid]);
      o.legs = f && rng.chance(0.4) ? "skirt" : "trousers";
      o.legTone = rng.pick([T.light, T.mid]);
      o.feet = rng.pick(["boots", "shoes", "trainers"] as const);
      o.feetTone = o.feet === "trainers" ? T.light : T.deep;
      if (f) {
        o.hat = "headscarf";
        o.hatTone = rng.pick([T.mid, T.dark, T.light]);
      } else if (rng.chance(0.5)) {
        o.hat = "beanie";
        o.hatTone = T.deep;
      }
      idle = rng.chance(0.6) ? { right: null, left: "bundle" } : idle;
      stand = idle.left ? "hold" : "crossed";
      carry = "bundle";
      break;
    }
    case "volunteer": {
      o.top = "jumper";
      o.topTone = rng.pick([T.dark, T.deep, T.mid]);
      o.over = "tabard";
      o.overTone = T.paper;
      o.legTone = rng.pick([T.light, T.mid]);
      o.legs = rng.chance(0.4) ? "jeans" : "trousers";
      o.feet = rng.pick(["trainers", "boots"] as const);
      o.feetTone = o.feet === "trainers" ? T.paper : T.deep;
      ex.push("lanyard");
      idle = rng.chance(0.5) ? { right: null, left: "clipboard" } : idle;
      stand = idle.left ? "hold" : rng.pick(["hang", "crossed"] as const);
      tool = "clipboard";
      work = "write";
      carry = "crate";
      break;
    }
  }
  o.extras = [...o.extras, ...ex];
  return { age, fem, outfit: o, stand, idle, tool, work, carry };
}

/** Which held props a pose uses, given a role's defaults. */
export function posePropsFor(pose: Pose, spec: RoleSpec): { right: HeldProp | null; left: HeldProp | null } {
  switch (pose) {
    case "stand":
    case "walk":
    case "queue":
    case "watch":
      return spec.idle;
    case "point":
    case "wave":
      // The busy hand keeps its prop; the other arm gestures.
      return { right: spec.idle.right, left: spec.idle.right ? null : spec.idle.left };
    case "work":
      if (spec.tool === "clipboard" || spec.tool === "tablet") return { right: null, left: spec.tool };
      if (spec.tool === "lamp") return { right: "lamp", left: null };
      return { right: spec.tool, left: null };
    case "hold-sign":
      return { right: "sign", left: null };
    case "carry":
      return spec.carry === "suitcase" || spec.carry === "medic-bag" || spec.carry === "lamp" || spec.carry === "toolbox"
        ? { right: spec.carry, left: null }
        : spec.carry === "sign"
          ? { right: "sign", left: null }
          : { right: spec.carry, left: null };
    case "sit":
    case "kneel":
    case "cower":
    case "tied":
    case "lie":
    case "wheelchair":
      return { right: null, left: spec.idle.left === "teddy" ? "teddy" : null };
  }
}
