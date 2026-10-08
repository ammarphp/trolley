/**
 * Adapter from the brand system to the wire's brand bridge
 * (src/ui/components/wire/brand-bridge.ts). The shape matches its WireBrand
 * interface structurally, returning SVG strings (which the bridge parses),
 * so connecting it is one line at start-up:
 *
 *   import { setWireBrand } from "./components/wire/brand-bridge.ts";
 *   import { brandForWire } from "./brand/index.ts";
 *   setWireBrand(brandForWire());
 *
 * This file imports nothing from the wire, so either side can change
 * independently.
 */
import { avatarFor } from "./avatars.ts";
import { flagFor } from "./flags.ts";
import { logoFor, sealFor } from "./logos.ts";
import { morrowMark } from "./morrow.ts";
import { thumbnailFor } from "./thumbs.ts";

export interface WireBrandLike {
  logo(outletId: string, options: { size: number; name?: string }): string;
  avatar(handle: string, options: { bot: boolean; blank?: boolean; size: number }): string;
  thumbnail(topic: string, seed: string, options: { wide: boolean }): string;
  flag(nationId: string, size: number): string;
  seal(issuerId: string, size: number): string;
  morrowMark(size: number): string;
}

export function brandForWire(): WireBrandLike {
  return {
    logo: (id, o) => logoFor(id, { size: o.size, variant: "mark", name: o.name }),
    avatar: (handle, o) => avatarFor(handle, { bot: o.bot, blank: o.blank, size: o.size }),
    // The wire shows 16:9 wide cards and small squares; plates are 16:10 and
    // crop cleanly (preserveAspectRatio slice keeps the subject centred).
    thumbnail: (topic, seed, o) => thumbnailFor(topic, seed, o.wide ? { width: 320, height: 180 } : { width: 64, height: 64 }),
    flag: (nationId, size) => flagFor(nationId, size, { uniform: true }),
    seal: (issuerId, size) => sealFor(issuerId, size),
    morrowMark: (size) => morrowMark("idle", { size }),
  };
}
