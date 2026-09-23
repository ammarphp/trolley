import { mkdir, rm, cp, readFile, writeFile, stat } from "node:fs/promises";
import { build } from "esbuild";
import { gzipSync } from "node:zlib";
import path from "node:path";
import {
  CAMPAIGN_MANIFEST,
  CAMPAIGN_NODES,
} from "../src/content/campaign/index.ts";
import { createCampaign } from "../src/simulation/index.ts";
const release = await createCampaign(
  CAMPAIGN_MANIFEST,
  CAMPAIGN_NODES,
  "release-validation",
);
const repository = (
  process.env.REPOSITORY_URL || "https://github.com/ammarphp/trolley"
).replace(/\/$/, "");
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const file of ["index.html", "legacy.html"])
  await cp(file, `dist/${file}`);
await cp("public", "dist", {
  recursive: true,
  filter: (source) => !/(?:^|\/)(?:spike(?:\.[^/]+)?|.*\.pdf)$/.test(source),
});
// Review material stays local. Only the campaign and its public documentation
// are deployment artifacts; no reports folder is copied to Pages.
// v1 stays a read/export/withdrawal-compatible isolated page. Do not publish v2 source or local books.
await cp("src", "dist/src", {
  recursive: true,
  filter: (source) =>
    !source.endsWith(".ts") &&
    !/(?:^|\/)(?:contracts|simulation|content|ui|persistence|telemetry|presentation)(?:\/|$)/.test(
      source,
    ),
});
await build({
  entryPoints: ["src/ui/game.css"],
  outfile: "dist/game.css",
  bundle: true,
  minify: true,
  target: ["es2022"],
});
await build({
  entryPoints: ["src/ui/app.ts"],
  outfile: "dist/game.js",
  bundle: true,
  format: "esm",
  target: ["es2022"],
  minify: true,
  sourcemap: false,
  legalComments: "eof",
});
// Publish player-facing methods and operating documentation, not local QA,
// draft handoffs or private research artifacts. Non-site developer links point
// to the corresponding repository file rather than a missing Pages path.
const publicDocs = [
  "README.md",
  "LICENSE",
  "docs/METHODOLOGY.md",
  "docs/METHODOLOGY_V2.md",
  "docs/PRIVACY.md",
  "docs/DEPLOYMENT.md",
  "docs/ARCHITECTURE.md",
];
for (const file of publicDocs) {
  await mkdir(path.dirname(`dist/${file}`), { recursive: true });
  const repository = (
    process.env.REPOSITORY_URL || "https://github.com/ammarphp/trolley"
  ).replace(/\/$/, "");
  const content = (await readFile(file, "utf8")).replace(
    /\]\(([^)]+)\)/g,
    (match, target) => {
      if (/^(?:[a-z]+:|#|\/)/i.test(target)) return match;
      const resolved = path.posix.normalize(
        path.posix.join(path.posix.dirname(file), target),
      );
      if (publicDocs.includes(resolved.split("#")[0])) return match;
      return `](${repository}/blob/main/${resolved})`;
    },
  );
  await writeFile(`dist/${file}`, content);
}
const config = JSON.parse(await readFile("dist/config.json", "utf8"));
if (process.env.COLLECTOR_URL) config.collectorUrl = process.env.COLLECTOR_URL;
config.collectorV2Enabled = process.env.COLLECTOR_V2_ENABLED === "true";
config.repositoryUrl =
  process.env.REPOSITORY_URL ||
  config.repositoryUrl ||
  "https://github.com/ammarphp/trolley";
config.operatorName =
  process.env.OPERATOR_NAME || config.operatorName || "ammarphp";
config.contactUrl =
  process.env.CONTACT_URL ||
  config.contactUrl ||
  "https://github.com/ammarphp/trolley/issues";
await writeFile("dist/config.json", JSON.stringify(config, null, 2) + "\n");
await writeFile("dist/.nojekyll", "");
try {
  await stat("dist/reports");
  throw new Error("Private review material must not enter the Pages artifact.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const bundle = await readFile("dist/game.js");
const critical =
  gzipSync(bundle).byteLength +
  gzipSync(await readFile("dist/game.css")).byteLength +
  gzipSync(await readFile("dist/index.html")).byteLength;
if (critical > 3 * 1024 * 1024)
  throw new Error(`Initial transfer budget exceeded: ${critical}`);
await writeFile(
  "dist/build-manifest.json",
  JSON.stringify(
    {
      engine: "2.0.0",
      content: CAMPAIGN_MANIFEST.contentVersion,
      profile:
        CAMPAIGN_MANIFEST.profile === "story"
          ? "production"
          : "development-campaign",
      contentHash: release.contentHash,
      manifestHash: release.manifestHash,
      nodes: CAMPAIGN_NODES.length,
      reviewedNodes: CAMPAIGN_NODES.filter((n) => n.reviewStatus === "reviewed")
        .length,
      stageBudgets: CAMPAIGN_MANIFEST.stageBudgets,
      collectorV2Enabled: config.collectorV2Enabled,
      criticalGzipBytes: critical,
      reviewArtifacts: [],
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Built dist/ with relative Pages paths. Critical gzip: ${Math.round(critical / 1024)} KiB. Collector v2: ${config.collectorV2Enabled ? "enabled" : "disabled"}.`,
);
