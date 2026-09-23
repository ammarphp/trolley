import type { PreparedDecision } from "../contracts/index.ts";
import type { SceneView } from "./types.ts";

/** Scene authoring follows semantic option order. Side randomization happens
 * only here, so the picture and keyboard choice always describe the same route. */
export function routeFigures(
  p: PreparedDecision,
): Pick<SceneView, "figures" | "figureKind"> {
  let figures = p.node.scene.figures;
  let kinds = p.node.scene.figureKind;
  if (p.node.id === "S1-01" && !kinds) {
    figures = { left: 1, right: 1 };
    const kind = (id: string) =>
      id === "forms" ? ("cup" as const) : ("parcel" as const);
    kinds = {
      left: kind(p.node.options[0].id),
      right: kind(p.node.options[1].id),
    };
  }
  if (p.node.id === "S1-05" && !kinds) {
    figures = { left: 1, right: 1 };
    const kind = (id: string) =>
      id === "hat" ? ("umbrella" as const) : ("hat" as const);
    kinds = {
      left: kind(p.node.options[0].id),
      right: kind(p.node.options[1].id),
    };
  }
  const reversed = p.leftOptionId !== p.node.options[0].id;
  const orient = <T>(value: { left: T; right: T }) =>
    reversed ? { left: value.right, right: value.left } : value;
  return {
    figures: orient(figures),
    ...(kinds ? { figureKind: orient(kinds) } : {}),
  };
}
