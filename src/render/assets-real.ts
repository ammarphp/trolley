/**
 * The production asset provider. Integrates the asset library modules; any
 * category not yet available falls back to the placeholder ink blocks.
 */
import { placeholderAssets, type AssetProvider } from "./assets.ts";

export const realAssets: AssetProvider = { ...placeholderAssets };
