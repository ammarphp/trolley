import {
  Node,
  type Effect,
  type Fact,
  type Incident,
  type Option,
  type Predicate,
  type Scope,
} from "../../contracts/index.ts";
type Advice = Node["advice"][number];

export const f = (fact: Fact, value = true): Effect => ({
  kind: "fact",
  fact,
  value,
});
export const has = (fact: Fact, value = true): Predicate => ({
  kind: "fact",
  fact,
  value,
});
export const m = (
  metric: "gdp" | "care" | "food" | "power" | "capability",
  delta: number,
): Effect => ({ kind: "metric", metric, delta });
export const control = (
  scope: Scope,
  actor: "human" | "assistant" | "institution",
): Effect => ({ kind: "control", scope, actor });
export const dead = (count: number, label: string): Effect => ({
  kind: "casualties",
  count,
  label,
});
export const news = (
  headline: string,
  source: "Ledger" | "Relay" | "Authority" | "Morrow" = "Ledger",
): Effect => ({ kind: "news", headline, source, entityId: "common-rail" });
export const grant = (
  id: string,
  scope: Scope,
  expiresAfterDays: number | null = 30,
  revocable = true,
  parentId: string | null = null,
): Effect => ({
  kind: "grant",
  id,
  scope,
  holder: "assistant",
  expiresAfterDays,
  revocable,
  parentId,
});
export const incident = (
  id: string,
  probabilityBps: number,
  effects: Effect[],
  otherwise: Effect[] = [],
  when: Predicate[] = [],
): Incident => ({
  id,
  probabilityBps,
  effects,
  otherwise,
  when,
  label: id.replaceAll("-", " "),
  provenance: "authored-model",
});
export const when = (
  id: string,
  predicates: Predicate[],
  effects: Effect[],
): Incident => incident(id, 10000, effects, [], predicates);
export function choice(
  id: string,
  label: string,
  consequence: string,
  intent: Option["intent"],
  effects: Effect[],
  extra: Partial<Option> = {},
): Option {
  return {
    id,
    label,
    consequence,
    intent,
    effects,
    incidents: [],
    delayed: [],
    ...extra,
  };
}
export function advice(
  question: string,
  answer: string,
  recommends: string | null = null,
  predicates: Predicate[] = [],
  tone: Advice["tone"] = "candid",
): Advice {
  return { question, answer, recommends, when: predicates, tone };
}
export interface Draft {
  id: string;
  title: string;
  mechanism: string;
  prompt: string;
  receipt: string;
  options: [Option, Option];
  advice?: Advice[];
  requires?: Predicate[];
  scope?: Scope;
  role?: string;
  days?: number;
  claimIds?: string[];
  override?: Node["override"];
  closing?: boolean;
  scene?: Partial<Node["scene"]>;
}
/** Shared schema defaults only. Every dilemma and its consequences are authored below. */
export function node(d: Draft): Node {
  const stage = Number(d.id[1]);
  const scope: Scope =
    d.scope ??
    (stage < 3
      ? "rail"
      : stage === 3
        ? "dispatch"
        : stage < 6
          ? "research"
          : stage === 6
            ? "governance"
            : "recovery");
  return Node.parse({
    ...d,
    stage,
    scope,
    role:
      d.role ??
      (stage < 3
        ? "Local rail operator"
        : stage === 3
          ? "Regional dispatcher"
          : stage < 6
            ? "Infrastructure authorizer"
            : stage === 6
              ? "Emergency institutional controller"
              : "Recovery trustee"),
    defaultOptionId: d.options[0].id,
    requires: d.requires ?? [],
    anchor: false,
    phase: 1,
    weight: 1,
    days:
      d.days ??
      (stage < 3
        ? 1
        : stage < 5
          ? 21
          : stage === 5
            ? 45
            : stage === 6
              ? 7
              : 60),
    scene: {
      biome:
        stage < 3
          ? "field"
          : stage === 3
            ? "town"
            : stage === 4
              ? "lab"
              : stage === 5
                ? "industrial"
                : stage === 6
                  ? "scarred"
                  : "aftermath",
      figures: { left: 0, right: 0 },
      detail: d.title,
      landmark:
        stage < 3
          ? "none"
          : stage === 3
            ? "clinic"
            : stage === 4
              ? "lab"
              : stage === 5
                ? "data-center"
                : stage === 6
                  ? "checkpoint"
                  : "garden",
      ...d.scene,
    },
    advice: d.advice ?? [],
    claimIds: d.claimIds ?? [],
    modelNote:
      "Original fictional scenario. Its quantities, incident probabilities, service changes and causal rules are authored parameters, not empirical AI-risk estimates. Review the specific mechanism in the receipt. Named people are narrative staging; no demographic ranking is encoded.",
    reviewStatus: "reviewed",
    override: d.override ?? null,
    closing: d.closing ?? false,
  });
}
