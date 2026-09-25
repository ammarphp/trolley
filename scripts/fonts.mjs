// Copy the self-hosted Latin font subsets next to a built stylesheet.
import { mkdir, copyFile } from "node:fs/promises";
import path from "node:path";

export const FONT_FILES = [
  ["@fontsource-variable/geist/files/geist-latin-wght-normal.woff2", "geist-latin-wght-normal.woff2"],
  ["@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2", "geist-latin-ext-wght-normal.woff2"],
  ["@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2", "geist-mono-latin-wght-normal.woff2"],
];

export async function copyFonts(outDir) {
  await mkdir(path.join(outDir, "fonts"), { recursive: true });
  for (const [from, to] of FONT_FILES) await copyFile(path.join("node_modules", from), path.join(outDir, "fonts", to));
}
