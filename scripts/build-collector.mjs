import { build } from "esbuild";
import { mkdir, cp, writeFile, access } from "node:fs/promises";
await mkdir(".build/collector", { recursive: true });
await build({
  entryPoints: ["collector/entry.js"],
  outfile: ".build/collector/worker.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: false,
});
console.log(
  "Built collector wrapper. No service was provisioned or activated.",
);
// Retain the repository's existing Sites packaging path as an explicit option.
// This reads existing hosting metadata; it does not create an account or publish.
if (process.argv.includes("--sites")) {
  await access(".collector-site/.openai/hosting.json");
  await mkdir(".collector-site/dist/server", { recursive: true });
  await cp(
    ".build/collector/worker.js",
    ".collector-site/dist/server/index.js",
  );
  await mkdir(".collector-site/source", { recursive: true });
  await cp("collector", ".collector-site/source/collector", {
    recursive: true,
    filter: (name) => !name.includes(".sqlite"),
  });
  await cp("src", ".collector-site/source/src", { recursive: true });
  await writeFile(
    ".collector-site/package.json",
    JSON.stringify(
      {
        name: "trolley-anonymous-run-collector",
        private: true,
        type: "module",
        scripts: { build: "node build.mjs" },
      },
      null,
      2,
    ) + "\n",
  );
  await writeFile(
    ".collector-site/build.mjs",
    'console.log("Prebuilt Worker ready.");\n',
  );
  await mkdir(".collector-site/dist/.openai", { recursive: true });
  await cp(
    ".collector-site/.openai/hosting.json",
    ".collector-site/dist/.openai/hosting.json",
  );
  console.log("Prepared existing Sites package locally. Nothing was pushed.");
}
