import { Node, type Effect, type Predicate } from "../contracts/index.ts";
/** A prose edition cannot change the simulation. IDs address existing slots. */
export interface ProseNode {
  nodeId: string;
  title: string;
  prompt: string;
  options: {
    optionId: string;
    label: string;
    consequence: string;
    consequenceVariants?: { when: Predicate[]; text: string }[];
  }[];
  advice: {
    index: number;
    question: string;
    answer: string;
    reasoning?: string;
  }[];
  newsReplacements: { path: string; headline: string }[];
}
function newsTarget(node: Node, path: string): Effect {
  // Only existing news-effect slots can be addressed. No arbitrary object paths,
  // executable callbacks, effect insertion or mechanical edits are supported.
  const direct = /^options\[(\d+)\]\.effects\[(\d+)\]\.headline$/.exec(path);
  if (direct)
    return node.options[Number(direct[1])]?.effects[Number(direct[2])];
  const delayed =
    /^options\[(\d+)\]\.delayed\[(\d+)\]\.effects\[(\d+)\]\.headline$/.exec(
      path,
    );
  if (delayed)
    return node.options[Number(delayed[1])]?.delayed[Number(delayed[2])]
      ?.effects[Number(delayed[3])];
  const incident =
    /^options\[(\d+)\]\.incidents\[(\d+)\]\.(effects|otherwise)\[(\d+)\]\.headline$/.exec(
      path,
    );
  if (incident)
    return node.options[Number(incident[1])]?.incidents[Number(incident[2])]?.[
      incident[3] as "effects" | "otherwise"
    ][Number(incident[4])];
  throw new Error(`Unsupported editorial news target: ${path}`);
}
export function applyProseEdition(bank: Node[], edition: ProseNode[]): Node[] {
  const revised = structuredClone(bank);
  const seen = new Set<string>();
  for (const prose of edition) {
    if (seen.has(prose.nodeId))
      throw new Error(`Duplicate prose node ${prose.nodeId}`);
    seen.add(prose.nodeId);
    const node = revised.find((item) => item.id === prose.nodeId);
    if (!node) throw new Error(`Unknown prose node ${prose.nodeId}`);
    node.title = prose.title;
    node.prompt = prose.prompt;
    if (
      prose.options.length !== node.options.length ||
      prose.advice.length !== node.advice.length
    )
      throw new Error(
        `Prose edition must preserve all action and advice slots: ${node.id}`,
      );
    const optionIds = new Set<string>();
    for (const option of prose.options) {
      const target = node.options.find((item) => item.id === option.optionId);
      if (!target || optionIds.has(option.optionId))
        throw new Error(`Invalid prose option ${node.id}/${option.optionId}`);
      optionIds.add(option.optionId);
      target.label = option.label;
      target.consequence = option.consequence;
      if (option.consequenceVariants)
        target.consequenceVariants = structuredClone(
          option.consequenceVariants,
        );
    }
    const adviceIndices = new Set<number>();
    for (const advice of prose.advice) {
      const target = node.advice[advice.index];
      if (
        !Number.isSafeInteger(advice.index) ||
        !target ||
        adviceIndices.has(advice.index)
      )
        throw new Error(`Invalid prose advice ${node.id}/${advice.index}`);
      adviceIndices.add(advice.index);
      target.question = advice.question;
      target.answer = advice.answer;
      if (advice.reasoning) target.reasoning = advice.reasoning;
    }
    for (const replacement of prose.newsReplacements) {
      const target = newsTarget(node, replacement.path);
      if (!target || target.kind !== "news")
        throw new Error(
          `Editorial target is not news: ${node.id}/${replacement.path}`,
        );
      target.headline = replacement.headline;
    }
  }
  return revised.map((node) => Node.parse(node));
}
