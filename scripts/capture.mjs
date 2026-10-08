// Play a full run in a GPU browser and photograph it.
//   node scripts/capture.mjs [--out docs/media/run] [--policy first|second|cautious] [--at 1,4,8,12,...]
//        [--w 1440 --h 900] [--settle 7] [--port 4191] [--motion]
// Serves dist/ itself. Screenshots are named NN-stageS.png plus ending.png.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const out = opt("out", "test-results/capture");
const policy = opt("policy", "cautious");
const at = new Set(opt("at", "1,3,6,9,12,15,18,21,24,27,30,33,36,39,42").split(",").map(Number));
const width = Number(opt("w", 1440));
const height = Number(opt("h", 900));
const settle = Number(opt("settle", 7)) * 1000;
const port = Number(opt("port", 4191));
const motion = args.includes("--motion");
await mkdir(out, { recursive: true });

const server = spawn(process.execPath, ["scripts/serve.mjs", "dist"], { env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
await once(server.stdout, "data");
const gpu = process.platform === "darwin" ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const browser = await chromium.launch({ headless: true, args: gpu });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width, height }, reducedMotion: motion ? "no-preference" : "reduce" });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`http://127.0.0.1:${port}/?private=1`);
  await page.getByRole("button", { name: "Start the trolley", exact: true }).waitFor();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/00-title.png` });
  await page.getByRole("button", { name: "Start the trolley", exact: true }).click();
  let n = 0;
  for (let guard = 0; guard < 50; guard++) {
    if (await page.locator(".debrief").count()) break;
    await page.locator(".route").first().waitFor({ timeout: 60000 });
    n++;
    const stage = await page.evaluate(() => document.body.dataset.stage);
    // Ask Morrow once when available, so the window has content in captures.
    const chip = page.locator("#assistant-panel button.chat-prompt, #assistant-panel .morrow-chip, #assistant-panel [data-question]").first();
    if (await chip.count().catch(() => 0)) await chip.click().catch(() => {});
    if (at.has(n)) {
      await page.waitForTimeout(settle);
      await page.screenshot({ path: `${out}/${String(n).padStart(2, "0")}-stage${stage}.png` });
    }
    // Move off any glossary term so its card closes before reaching for a route.
    await page.mouse.move(4, 4);
    await page.waitForTimeout(450);
    const routes = page.locator(".route");
    const labels = await routes.allInnerTexts();
    let pick = 0;
    if (policy === "second") pick = 1;
    if (policy === "cautious") {
      const idx = labels.findIndex((l) => /(delay|review|inspect|keep|refuse|revoke|verify|wait|independent|manual|stop|check|hold|slow|limit|pause|second)/i.test(l));
      pick = idx >= 0 ? idx : 0;
    }
    await routes.nth(pick).click();
    await page.locator("#lever").click();
    await page.locator(".continue").waitFor({ timeout: 60000 });
    if (at.has(n)) {
      await page.waitForTimeout(Math.min(settle, 2500));
      await page.screenshot({ path: `${out}/${String(n).padStart(2, "0")}-stage${stage}-after.png` });
    }
    await page.locator(".continue").click();
  }
  await page.waitForTimeout(settle);
  await page.screenshot({ path: `${out}/ending.png` });
  await page.screenshot({ path: `${out}/ending-full.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/ending-phone.png`, fullPage: false });
  console.log(`Captured ${n} decisions to ${out}. Errors: ${JSON.stringify(errors.slice(0, 8))}`);
} finally {
  await browser.close();
  server.kill();
}
