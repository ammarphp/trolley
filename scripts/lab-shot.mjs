// Render one lab scene to a PNG through the real ink pipeline on the GPU.
//   node scripts/lab-shot.mjs <scene> --file src/render/x/y.lab.ts --out /path/shot.png
//        [--w 1280] [--h 720] [--t 1.5] [--params '{"k":1}'] [--seed s] [--dpr 1]
// Prints console errors from the page. Exit code 1 if the scene failed.
import { chromium } from "playwright";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { buildLab, serve } from "./lab.mjs";

const args = process.argv.slice(2);
const scene = args[0];
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
if (!scene || scene.startsWith("--")) {
  console.error("usage: node scripts/lab-shot.mjs <scene> --file <lab file> --out <png>");
  process.exit(2);
}
const out = path.resolve(opt("out", `lab-${scene}.png`));
await mkdir(".lab", { recursive: true });
const dir = await mkdtemp(path.join(".lab", "shot-"));
let code = 0;
try {
  await buildLab({ file: opt("file"), out: dir });
  const server = await serve(dir, 0);
  const port = server.address().port;
  const gpuArgs = process.platform === "darwin" ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
  const browser = await chromium.launch({ headless: true, args: gpuArgs });
  const page = await browser.newPage({
    viewport: { width: Number(opt("w", 1280)), height: Number(opt("h", 720)) },
    deviceScaleFactor: Number(opt("dpr", 1)),
  });
  const logs = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  const q = new URLSearchParams({ scene, t: opt("t", "1"), params: opt("params", "{}"), seed: opt("seed", "lab"), dpr: opt("dpr", "1") });
  await page.goto(`http://127.0.0.1:${port}/index.html?${q}`);
  await page.waitForFunction(() => window.__labReady === true || !!window.__labError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.__labError);
  if (err) {
    console.error(err);
    code = 1;
  }
  const scenes = await page.evaluate(() => window.__labScenes);
  if (!scenes?.includes(scene)) {
    console.error(`Scene "${scene}" not found. Available: ${scenes?.join(", ")}`);
    code = 1;
  }
  await page.screenshot({ path: out });
  for (const l of logs) console.log(l);
  console.log(`Wrote ${out}`);
  await browser.close();
  server.close();
} finally {
  await rm(dir, { recursive: true, force: true });
}
process.exit(code);
