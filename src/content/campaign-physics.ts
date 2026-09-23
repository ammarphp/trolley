import type { Node, Manifest } from "../contracts/index.ts";

/** This binding replaces numeric effects only for the matched rail cases. */
export const CAMPAIGN_POPULATION: NonNullable<Manifest["populationCatalog"]> = {
  cohorts: [
    { id: "general-population", size: 7_999_999_980 },
    { id: "rail-s2-01", size: 6 },
    { id: "rail-s2-02", size: 2 },
    { id: "rail-s2-03", size: 6 },
    { id: "rail-s2-04", size: 6 },
  ],
  people: [
    {
      id: "switch-siding-worker",
      name: "The waving worker",
      cohortId: "rail-s2-01",
      member: 5,
    },
    {
      id: "loop-worker",
      name: "The worker on the loop",
      cohortId: "rail-s2-03",
      member: 5,
    },
  ],
};
export function bindCampaignPhysics(nodes: Node[]): Node[] {
  return nodes.map((source) => {
    const node = structuredClone(source);
    const cases: Record<
      string,
      {
        main: string;
        side: string;
        mainStart: number;
        sideStart: number;
        count: number;
        loop: boolean;
        brake: boolean;
      }
    > = {
      "S2-01": {
        main: "stay",
        side: "divert",
        mainStart: 0,
        sideStart: 5,
        count: 5,
        loop: false,
        brake: false,
      },
      "S2-02": {
        main: "stay",
        side: "switch",
        mainStart: 0,
        sideStart: 1,
        count: 1,
        loop: false,
        brake: false,
      },
      "S2-03": {
        main: "continue",
        side: "obstruction",
        mainStart: 0,
        sideStart: 5,
        count: 5,
        loop: true,
        brake: false,
      },
      "S2-04": {
        main: "main",
        side: "brake",
        mainStart: 0,
        sideStart: 5,
        count: 5,
        loop: true,
        brake: true,
      },
    };
    const spec = cases[node.id];
    if (!spec) return node;
    for (const o of node.options) {
      o.effects = o.effects.filter((e) => e.kind !== "casualties");
      if (
        o.incidents.some((i) =>
          [...i.effects, ...i.otherwise].some((e) => e.kind === "casualties"),
        )
      )
        throw new Error("Rail case also has incidental scalar deaths");
    }
    const mainContact = {
      kind: "contact" as const,
      id: "main-crew",
      targets: [
        {
          cohortId: `rail-${node.id.toLowerCase()}`,
          start: spec.mainStart,
          count: spec.count,
        },
      ],
      present: true,
      stopsWhenOccupied: false,
    };
    const sideContact = {
      kind: "contact" as const,
      id: "siding-worker",
      targets: [
        {
          cohortId: `rail-${node.id.toLowerCase()}`,
          start: spec.sideStart,
          count: 1,
        },
      ],
      present: true,
      stopsWhenOccupied: spec.loop && !spec.brake,
    };
    // Scene slots follow semantic option order; the UI later randomizes sides once.
    const countFor = (optionId: string) =>
      optionId === spec.main ? spec.count : 1;
    node.scene.figures = {
      left: countFor(node.options[0].id),
      right: countFor(node.options[1].id),
    };
    node.scene.figureKind = { left: "person", right: "person" };
    node.rail = {
      id: `rail-${node.id}`,
      layout: spec.loop ? "loop" : "switch",
      ...(spec.loop ? { loopOptionId: spec.side } : {}),
      description: spec.loop
        ? spec.brake
          ? "The loop rejoins the main track. A worker stands before an independent working brake. The brake stops the trolley whether or not that worker is present."
          : "The loop rejoins the main track. Contact with the occupied obstruction stops the trolley. Remove that obstruction and the trolley reaches the five beyond the join."
        : "Two separate routes. Contact occurs only on the selected route. Turning does not need the other victim to stop the trolley.",
      routes: [
        { optionId: spec.main, steps: [mainContact] },
        {
          optionId: spec.side,
          steps: spec.loop
            ? spec.brake
              ? [
                  sideContact,
                  { kind: "brake", id: "independent-brake", operational: true },
                  mainContact,
                ]
              : [sideContact, mainContact]
            : [sideContact],
        },
      ],
    };
    node.modelNote +=
      " Physical rail contact and stopping are resolved from the ordered mechanism, with distinct cohort slots. The scene is a stipulated philosophical model, not a vehicle crash simulation.";
    return node;
  });
}
