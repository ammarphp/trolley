// Deployment boundary: legacy reads/withdrawal survive the v2 cutover.
import legacy from "./worker.js";
import { handler, cleanupV2, refreshAggregatesV2 } from "./v2/index.ts";
import { SLICE_MANIFEST, SLICE_NODES } from "../src/content/slice.ts";
import { CAMPAIGN_MANIFEST, CAMPAIGN_NODES } from "../src/content/campaign/index.ts";

const bundles = [{ manifest: CAMPAIGN_MANIFEST, nodes: CAMPAIGN_NODES }, { manifest: SLICE_MANIFEST, nodes: SLICE_NODES }];
function environment(env) {
  return { ...env, V2_BUNDLES: bundles };
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname.replace(/\/$/, "");
    if (path.startsWith("/v2/")) return handler(request, environment(env));
    if (request.method === "POST" && ["/runs", "/responses"].includes(path)) {
      const origin = request.headers.get("origin");
      const allowed = (env.ALLOWED_ORIGINS || "")
        .split(",")
        .map((s) => s.trim());
      return Response.json(
        {
          error:
            "Legacy collection is closed. Existing run withdrawal remains available.",
        },
        {
          status: 410,
          headers: {
            "Cache-Control": "no-store",
            Vary: "Origin",
            ...(origin && allowed.includes(origin)
              ? { "Access-Control-Allow-Origin": origin }
              : {}),
          },
        },
      );
    }
    return legacy.fetch(request, env);
  },
  async scheduled(_event, env, ctx) {
    if (!env.DB) return;
    ctx.waitUntil(
      (async () => {
        await cleanupV2(environment(env));
        if (env.V2_ENABLED === "true")
          await refreshAggregatesV2(environment(env));
      })(),
    );
  },
};
