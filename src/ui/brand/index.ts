/**
 * The brand system of the fictional world of "trolley.".
 *
 * Everything here returns self-contained SVG strings (inline fills, no
 * external CSS, no scripts) that parse with DOMParser as image/svg+xml, so
 * they can be dropped into innerHTML or handed to the wire's brand bridge.
 * All drawing is deterministic: the same inputs always draw the same picture.
 *
 *   logoFor(entityId, { size, variant })      marks, wordmarks, lockups
 *   flagFor(nationId, size)                   national flags
 *   avatarFor(handle, { bot })                account portraits
 *   thumbnailFor(topic, seed)                 pen-and-ink news plates
 *   morrowMark(state)                         Morrow, in cobalt (red once)
 *   velaWordmark(), trolleyWordmark()         lab and game wordmarks
 *   sealFor(issuerId)                         the Authority seal
 *   brandForWire()                            adapter for setWireBrand()
 */
export * from "./entities.ts";
export { logoFor, logoAspect, sealFor, velaWordmark, LOGO_ENTITIES, type LogoOptions, type LogoVariant } from "./logos.ts";
export { flagFor, flagRatio, FLAG_NATIONS, type FlagOptions } from "./flags.ts";
export { avatarFor, type AvatarOptions } from "./avatars.ts";
export { thumbnailFor, thumbTopic, THUMB_TOPICS, type ThumbTopic, type ThumbnailOptions } from "./thumbs.ts";
export { morrowMark, morrowLockup, MORROW_STATES, type MorrowState, type MorrowMarkOptions } from "./morrow.ts";
export { trolleyWordmark, type TrolleyWordmarkOptions } from "./wordmarks.ts";
export { brandForWire, type WireBrandLike } from "./wire-adapter.ts";
export { INK, PAPER, PIGMENT, FLAG_INK } from "./palette.ts";
