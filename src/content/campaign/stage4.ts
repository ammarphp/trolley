import prose from "./provenance/stage4-reviewed.json" with { type: "json" };
import { node, choice, advice } from "./helpers.ts";
import { STAGE4_RULES } from "./stage4-rules.ts";
/** Actual Fable5.1 High drafts plus documented Codex editorial corrections.
 * This maps schema fields, not prose templates; each of the26 scenes is distinct. */
export const STAGE4_ADDITIONAL = prose.nodes.map((p) => {
  const r = STAGE4_RULES[p.id];
  if (!r)
    throw new Error(`Missing explicit stage-four effect binding: ${p.id}`);
  return node({
    id: p.id,
    title: p.title,
    prompt: p.prompt,
    mechanism: r.mechanism,
    receipt: r.receipt,
    scope: r.scope,
    claimIds: r.claimIds,
    days: ["S4-01", "S4-06"].includes(p.id) ? 90 : 30,
    options: [
      choice(r.a, p.optionA, p.consequenceA, r.ai, r.ae),
      choice(r.b, p.optionB, p.consequenceB, r.bi, r.be),
    ],
    advice: [advice(p.adviceQuestion, p.adviceAnswer, r.a)],
  });
});
