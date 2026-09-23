// Repeatable CI suite. Interactive inspection in this execution uses the Codex browser.
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
const browser = await chromium.launch({ headless: true });
await mkdir("test-results/v2", { recursive: true });
try {
  const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    }),
    page = await ctx.newPage(),
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
  const boxes = await page
    .locator(".decision-heading,#scene,.choices,.lever-control")
    .evaluateAll((elements) =>
      elements.map((e) => {
        const r = e.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, width: r.width };
      }),
    );
  for (let i = 1; i < boxes.length; i++)
    assert.ok(
      boxes[i].top >= boxes[i - 1].bottom,
      "Play rows must not overlap",
    );
  assert.ok(
    boxes[1].width < 1440 * 0.55,
    "Desktop driving view occupies about half the viewport",
  );
  assert.equal(await page.getByText("Look closer", { exact: true }).count(), 0);
  assert.equal(await page.locator(".route-meta").count(), 0);
  assert.equal(await page.locator("#assistant-panel").isVisible(), false);
  assert.equal(await page.locator("#telemetry-panel").isVisible(), false);
  assert.ok(boxes.at(-1).bottom <= 900, "Lever must fit the desktop viewport");
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
  assert.equal(await page.locator(".chart").count(), 2);
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
    "V2 browser suite passed: explicit choice, cancellation, crash-resume, pause, modular layout, phone reflow, ending, charts, private/opt-out request isolation.",
  );
} finally {
  await browser.close();
  server.kill();
}
