import type { GlyphMood } from "./glyph-catalogue";
import type { World } from "../contracts/index.ts";

/** Reading time is not world time. Age contributes only modest material wear;
 * injuries and severe deterioration require accumulated harm and service loss. */
export function worldAppearance(w: World) {
  const serviceLoss =
    Math.max(0, 1000 - Math.min(w.care, w.power, w.food)) / 1000;
  const bereavement = Math.log10(1 + w.casualties) / 10;
  const materialAge = Math.min(0.18, Math.log10(1 + w.day) * 0.045);
  return {
    strain: Math.min(
      1,
      serviceLoss * 0.35 +
        bereavement * 0.55 +
        (w.facts.firstDeath ? 0.15 : 0) +
        (w.facts.authorityLost ? 0.3 : 0),
    ),
    damage: Math.min(
      1,
      materialAge +
        serviceLoss * 0.35 +
        bereavement * 0.28 +
        (w.facts.catastrophe ? 0.35 : 0) +
        (w.facts.authorityLost ? 0.08 : 0),
    ),
  };
}

/** Stage gates limit the onset; consequence damage determines its magnitude.
 * Cosmetic time never advances the horror or creates an injury. */
export function visualIntensity(
  stage: number,
  damage: number,
  strain: number,
  biome: string,
) {
  const d = Math.max(0, Math.min(1, damage));
  const onset = Math.max(0, Math.min(1, (stage - 2) / 4));
  const wear = d * onset;
  const injury = stage >= 6 && d > 0.6;
  const mood: GlyphMood = injury
    ? "injured"
    : biome === "pristine" && stage >= 6
      ? "vacant"
      : stage >= 4 || strain > 0.45
        ? "alert"
        : "calm";
  return { wear, injury, mood };
}
