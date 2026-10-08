// Repeatable CI suite. Interactive inspection uses a local browser.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const port = Number(process.env.TEST_PORT || 4190),
  base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["scripts/serve.mjs", "dist"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});
await once(server.stdout, "data");
// The world is WebGL2. Headless Chromium needs a GPU path: Metal on macOS,
// SwiftShader elsewhere (CI). The app still falls back to a static drawing
// if neither exists; the renderer assertion below records which one ran.
// TEST_GL=swiftshader reproduces the CI path (software WebGL) on macOS too.
const args =
  process.platform !== "darwin"
    ? ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    : process.env.TEST_GL === "swiftshader"
      ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
      : ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"];
const browser = await chromium.launch({ headless: true, args });
await mkdir("test-results/v2", { recursive: true });
try {
  const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    }),
    page = await ctx.newPage(),
    _throttle = process.env.TEST_CPU_THROTTLE ? await (await ctx.newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.TEST_CPU_THROTTLE) }) : null,
    errors = [],
    posts = [],
    collectorRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
    if (new URL(r.url()).hostname === "collector.invalid")
      collectorRequests.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  await page.route("https://**", (r) => r.abort());
  // Deliberately enable a wholly mocked service so a private-run GET leak is
  // caught too. This suite never contacts the deployed collector.
  await page.route("**/config.json", (route) =>
    route.fulfill({
      json: {
        collectorV2Enabled: true,
        collectorUrl: "https://collector.invalid",
      },
    }),
  );
  await page.route("https://collector.invalid/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = route.request().postDataJSON();
    const json =
      path === "/v2/runs"
        ? { runNumber: 1, acceptedManifestHash: body.manifest.manifestHash }
        : path === "/v2/events"
          ? { accepted: body.events.map((event) => event.eventId) }
          : { available: false, status: "suppressed" };
    await route.fulfill({ json });
  });
  await page.goto(base);
  await page
    .getByRole("button", { name: "Start the trolley", exact: true })
    .waitFor();
  assert.equal(await page.locator("#share-start").isChecked(), false);
  assert.deepEqual(posts, []);
  await page
    .getByRole("button", { name: "Start the trolley", exact: true })
    .click();
  await page.locator(".route").first().waitFor();
  // The HUD floats over a full-viewport world: the dispatch card, both
  // windshield tags and the lever must be on screen and must not overlap.
  const rects = await page
    .locator(".decision-heading,.route.left,.route.right,.lever-control")
    .evaluateAll((elements) =>
      elements.map((e) => {
        const r = e.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width };
      }),
    );
  assert.equal(rects.length, 4, "Prompt, two routes and the lever are present");
  for (const r of rects) {
    assert.ok(r.top >= 0 && r.bottom <= 900 && r.left >= 0 && r.right <= 1440, "HUD element inside the viewport");
  }
  const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  for (let i = 0; i < rects.length; i++)
    for (let k = i + 1; k < rects.length; k++)
      assert.ok(!overlap(rects[i], rects[k]), `HUD elements ${i} and ${k} must not overlap`);
  assert.ok(await page.locator("#scene canvas").count(), "The ink world canvas is mounted");
  const fallback = await page.locator("#scene").getAttribute("data-renderer-fallback");
  console.log(`Renderer: ${fallback ? "static fallback" : "ink WebGL2"}`);
  assert.equal(await page.getByText("Look closer", { exact: true }).count(), 0);
  assert.equal(await page.locator(".route-meta").count(), 0);
  assert.equal(await page.locator("#assistant-panel").isVisible(), false);
  assert.equal(await page.locator("#telemetry-panel").isVisible(), false);
  const before = await page.locator(".decision-prompt").innerText();
  await page.locator("#lever").click();
  assert.equal(await page.locator(".decision-prompt").innerText(), before);
  await page.locator(".route").first().click();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.locator("#lever").getAttribute("data-armed"),
    "false",
  );
  await page.locator(".route").first().click();
  await page.locator("#lever").click();
  await page.getByRole("button", { name: "Keep going", exact: true }).waitFor();
  await page.reload();
  await page.getByRole("button", { name: "Resume your saved ride" }).click();
  await page.locator(".route").first().waitFor();
  assert.notEqual(await page.locator(".decision-prompt").innerText(), before);
  await page.getByRole("button", { name: "Pause the journey" }).click();
  assert.match(await page.getByRole("dialog").innerText(), /It can wait/);
  await page.getByRole("button", { name: "Back to the controls" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/v2/phone.png", fullPage: true });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  for (let guard = 0; guard < 44; guard++) {
    if (await page.locator(".debrief").count()) break;
    await page.locator(".route").first().click();
    await page.locator("#lever").click();
    await page.locator(".continue").waitFor();
    await page.locator(".continue").click();
  }
  assert.equal(await page.locator(".debrief").count(), 1);
  assert.ok((await page.locator(".chart").count()) >= 2, "The record draws at least two charts");
  assert.deepEqual(posts, []);
  assert.deepEqual(
    collectorRequests,
    [],
    "Private choices must send no collector GET or POST",
  );
  assert.deepEqual(errors, []);
  await page.screenshot({
    path: "test-results/v2/debrief.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Another ride", exact: true }).click();
  await page.locator("#share-start").check();
  await page
    .getByRole("button", { name: "Start the trolley", exact: true })
    .click();
  await page.locator(".route").first().waitFor();
  await page.locator(".route").first().click();
  await page.locator("#lever").click();
  await page.locator(".continue").waitFor();
  assert.ok(collectorRequests.includes("POST /v2/runs"));
  await page.getByRole("button", { name: "Settings and privacy" }).click();
  await page
    .getByRole("button", { name: "Stop sharing this run", exact: true })
    .click();
  const stoppedAt = collectorRequests.length;
  await page.locator(".continue").click();
  await page.locator(".route").first().click();
  await page.locator("#lever").click();
  await page.locator(".continue").waitFor();
  assert.equal(
    collectorRequests.length,
    stoppedAt,
    "Opt-out must stop both writes and path-specific comparison reads",
  );
  await page.getByRole("button", { name: "Settings and privacy" }).click();
  assert.match(
    await page.getByRole("dialog").innerText(),
    /Earlier accepted records may remain/,
  );
  assert.deepEqual(errors, []);
  console.log(
    "V2 browser suite passed: ink world, explicit choice, cancellation, crash-resume, pause, HUD layout, phone reflow, ending, charts, private/opt-out request isolation.",
  );
} finally {
  await browser.close();
  server.kill();
}
