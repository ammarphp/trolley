import type { LabScene } from "./lab/types.ts";
import type { StageView, SideStaging } from "./api.ts";
import { InkWorldRenderer } from "./world-renderer.ts";
import { placeholderAssets, type AssetProvider } from "./assets.ts";
import { titleEnvironment } from "../presentation/derive.ts";

/** Full renderer with a scripted run. Params: { assets?: "placeholder"|"real", script?: [...] }. */
export async function worldLab(ctx: Parameters<LabScene["build"]>[0], assets: AssetProvider): Promise<void> {
  const host = ctx.domStage();
  host.style.background = "#fff";
  const renderer = new InkWorldRenderer({ host, assets, settings: { reducedMotion: false, reducedGraphics: false, audio: false, noFlashing: false, quality: "high" }, seed: "lab-run", manual: true, preserveDrawingBuffer: true });
  const staging: SideStaging = {
    left: { occupants: [{ kind: "people", role: "worker", count: 5, pose: "tied", spread: "across" }], sign: "STAY THE COURSE", beat: "impact", destination: "depot" },
    right: { occupants: [{ kind: "people", role: "worker", count: 1, pose: "wave" }], sign: "SIDING", beat: "impact", destination: "farmhouse" },
    landmarks: ["windmill"],
  };
  const base = (): StageView => ({
    phase: "consequence", seed: "lab-run", stage: 2, ordinal: 1, decisionId: null, nodeId: null, staging: null,
    routeLabels: { left: "Keep going", right: "Turn" }, env: { ...titleEnvironment(), ...(ctx.params.env as object ?? {}) },
    cabin: { face: { stage: 0, smile: 0.8, fatigue: 0, grief: 0, shock: 0, dissociation: 0, age: 0 }, impacts: 0, bloodied: 0, authority: "human", morrow: false, receipts: [], speedKmh: 40, clock: "06:40", keepsake: "coffee" },
    cues: [],
  });
  renderer.update(base());
  const script = (ctx.params.script as Array<[number, string, string?]>) ?? [[1, "decide", "d1"], [30, "commit", "left"]];
  let cursor = 0;
  ctx.onFrame((dt, t) => {
    while (cursor < script.length && t >= script[cursor]![0]) {
      const [, action, arg] = script[cursor]!;
      if (action === "decide") renderer.update({ ...base(), phase: "decision", decisionId: arg ?? "d", nodeId: "S2-01", staging, ordinal: 2 });
      if (action === "arm") renderer.setLever(arg === "left" ? -1 : 1, { armed: arg as "left" | "right" });
      if (action === "commit") void renderer.commit((arg as "left" | "right") ?? "left", "human");
      cursor++;
    }
    renderer.advance(dt, false);
  });
  // Render the last frame after the harness finishes stepping.
  const finish = () => renderer.advance(0.0001, true);
  (window as unknown as { __labFinish?: () => void }).__labFinish = finish;
}

export const scenes: LabScene[] = [
  {
    name: "world-placeholder",
    description: "The full ink world renderer with placeholder assets.",
    build: (ctx) => worldLab(ctx, placeholderAssets),
  },
];
