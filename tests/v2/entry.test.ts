import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
// @ts-expect-error shared legacy adapter is JavaScript
import { sqliteAdapter } from "../../collector/sqlite-adapter.js";
// @ts-expect-error deployment wrapper keeps compatibility with the legacy JavaScript worker
import entry from "../../collector/entry.js";
// @ts-expect-error preserved legacy JavaScript schema
import { SCHEMA } from "../../collector/schema.js";
test("deployment wrapper closes legacy writes but preserves existing withdrawals", async () => {
  const sql = new DatabaseSync(":memory:");
  sql.exec(SCHEMA);
  const runId = crypto.randomUUID(),
    runToken = crypto.randomUUID() + crypto.randomUUID();
  const hash = Buffer.from(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(runToken)),
  ).toString("hex");
  sql
    .prepare(
      "INSERT INTO runs(run_id,token_hash,mode,engine_version,notice_version) VALUES (?,?,'descent','legacy','legacy')",
    )
    .run(runId, hash);
  const env = {
    DB: sqliteAdapter(sql),
    ALLOWED_ORIGINS: "https://ammarphp.github.io",
  };
  try {
    for (const path of ["/runs", "/responses"])
      assert.equal(
        (
          await entry.fetch(
            new Request("https://collector.invalid" + path, { method: "POST" }),
            env,
          )
        ).status,
        410,
      );
    const withdrawal = await entry.fetch(
      new Request("https://collector.invalid/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId, runToken }),
      }),
      env,
    );
    assert.equal(withdrawal.status, 200);
    assert.equal((await withdrawal.json()).withdrawn, true);
    assert.equal(
      (sql.prepare("SELECT withdrawn FROM runs").get() as { withdrawn: number })
        .withdrawn,
      1,
    );
    const disabled = await entry.fetch(
      new Request("https://collector.invalid/v2/health"),
      env,
    );
    assert.equal(disabled.status, 200);
    assert.equal((await disabled.json()).collectionEnabled, false);
    const rejected = await entry.fetch(
      new Request("https://collector.invalid/v2/runs", { method: "POST" }),
      env,
    );
    assert.equal(rejected.status, 503);
  } finally {
    sql.close();
  }
});
