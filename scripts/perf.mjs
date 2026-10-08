// Measure frame times in the running game (GPU headless). Serves dist/.
//   node scripts/perf.mjs [--decisions 6] [--w 1440 --h 900]
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
const args = process.argv.slice(2);
const opt = (n, f) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : f; };
const port = 4192;
const server = spawn(process.execPath, ["scripts/serve.mjs", "dist"], { env: { ...process.env, PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
await once(server.stdout, "data");
const browser = await chromium.launch({ headless: true, args: process.platform === "darwin" ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : ["--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: Number(opt("w", 1440)), height: Number(opt("h", 900)) }, deviceScaleFactor: Number(opt("dpr", 1)) });
const sample = async (label) => {
  const r = await page.evaluate(() => new Promise((resolve) => {
    const times = []; let last = performance.now(); const end = last + 4000;
    const f = (now) => { times.push(now - last); last = now; if (now < end) requestAnimationFrame(f); else resolve(times); };
    requestAnimationFrame(f);
  }));
  r.sort((a, b) => a - b);
  const p = (q) => r[Math.min(r.length - 1, Math.floor(q * r.length))].toFixed(1);
  const info = await page.evaluate(() => { const c = document.querySelector("#scene canvas"); return c ? `${c.width}x${c.height}` : "no canvas"; });
  console.log(`${label.padEnd(18)} frames ${r.length}  p50 ${p(0.5)}ms  p95 ${p(0.95)}ms  max ${p(0.999)}ms  canvas ${info}`);
};
await page.goto(`http://127.0.0.1:${port}/?private=1`);
await page.getByRole("button", { name: "Start the trolley", exact: true }).waitFor();
await sample("title");
await page.getByRole("button", { name: "Start the trolley", exact: true }).click();
const n = Number(opt("decisions", 6));
for (let i = 1; i <= n; i++) {
  await page.locator(".route").first().waitFor({ timeout: 60000 });
  await sample(`decision ${i}`);
  await page.locator(".route").first().click();
  await page.locator("#lever").click();
  await page.locator(".continue").waitFor({ timeout: 60000 });
  await page.locator(".continue").click();
}
await browser.close();
server.kill();
