import { build } from "esbuild";
import { glob, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
await mkdir(".build/tests", { recursive: true });
const files = [];
for await (const file of glob([
  "tests/v2/**/*.test.ts",
  "src/presentation/**/*.test.ts",
]))
  files.push(file);
if (!files.length) throw new Error("No v2 tests found.");
const outputs = [];
for (const [i, file] of files.entries()) {
  const out = `.build/tests/${i}.test.mjs`;
  await build({
    entryPoints: [file],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: out,
    target: "node24",
    packages: "external",
  });
  outputs.push(out);
}
const result = spawnSync(process.execPath, ["--test", ...outputs], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
