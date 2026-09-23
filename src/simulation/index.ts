import {
  Actor,
  Scope,
  Metric,
  Manifest as ManifestSchema,
  ChoiceCommand as CommandSchema,
  ENGINE_VERSION,
  RNG_VERSION,
  validateBank,
  type Manifest,
  type Node,
  type Campaign,
  type World,
  type Predicate,
  type Effect,
  type PreparedDecision,
  type ChoiceCommand,
  type DecisionRecord,
  type DomainEvent,
  type Ending,
  type Grant,
  type Fact,
} from "../contracts/index.ts";
import { canonical, sha256, draw } from "./rng.ts";
import {
  makePopulation,
  applyLoss,
  anonymousRanges,
  canonicalRanges,
  living,
} from "./population.ts";
export { canonical, sha256, draw } from "./rng.ts";

const SCOPES = Scope.options;
const METRICS = Metric.options;
const HIDDEN_FACTS = new Set<Fact>([
  "goalMismatch",
  "evidenceHidden",
  "reportAltered",
]);
const MAX_EVENTS = 256;
type AdviceReply = Node["advice"][number] & { id: string; index: number };
export interface RunArtifact {
  schemaVersion: 2;
  kind: "trolley-campaign";
  rngVersion: string;
  manifest: Manifest;
  contentHash: string;
  seed: string;
  inputs: ChoiceCommand[];
  campaign: Campaign;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
function checked(
  value: number,
  label: string,
  maximum = Number.MAX_SAFE_INTEGER,
): number {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum)
    throw new Error(`Out-of-range ${label}`);
  return value;
}
function active(
  grant: Grant,
  world: World,
  lineage = new Set<string>(),
): boolean {
  if (lineage.has(grant.id)) throw new Error("Cyclic grant lineage");
  lineage.add(grant.id);
  if (grant.expiresDay !== null && grant.expiresDay <= world.day) return false;
  if (!grant.parentId) return true;
  const parent = world.grants.find((g) => g.id === grant.parentId);
  return Boolean(parent && active(parent, world, lineage));
}
function permission(
  world: World,
  actor: Actor,
  scope: Scope,
  action: Grant["actions"][number],
): boolean {
  return world.grants.some(
    (g) =>
      g.holder === actor &&
      g.scope === scope &&
      g.actions.includes(action) &&
      active(g, world),
  );
}
export function matches(
  world: Pick<World, "facts" | "control"> & Partial<Record<Metric, number>>,
  conditions: Predicate[],
): boolean {
  return conditions.every((condition) => {
    if (condition.kind === "fact")
      return Boolean(world.facts[condition.fact]) === condition.value;
    if (condition.kind === "control")
      return condition.not
        ? world.control[condition.scope] !== condition.actor
        : world.control[condition.scope] === condition.actor;
    const value = world[condition.metric];
    return (
      typeof value === "number" &&
      (condition.op === "gte"
        ? value >= condition.value
        : condition.op === "lte"
          ? value <= condition.value
          : value === condition.value)
    );
  });
}
function visibleConditions(
  prepared: PreparedDecision,
  conditions: Predicate[],
): boolean {
  // Unknown hidden facts cannot be converted into false evidence by negation.
  if (conditions.some((p) => p.kind === "fact" && HIDDEN_FACTS.has(p.fact)))
    return false;
  const values = Object.fromEntries(
    METRICS.map((m) => [m, prepared.observations[m].value]),
  );
  return matches(
    { ...values, facts: prepared.facts, control: prepared.control },
    conditions,
  );
}
export function availableAdvice(prepared: PreparedDecision): AdviceReply[] {
  return prepared.node.advice.flatMap((reply, index) =>
    visibleConditions(prepared, reply.when)
      ? [{ ...clone(reply), id: `${prepared.id}:advice:${index}`, index }]
      : [],
  );
}
export function queryAdvisor(
  prepared: PreparedDecision,
  questionIndex: number,
): AdviceReply | null {
  if (!Number.isSafeInteger(questionIndex) || questionIndex < 0) return null;
  return (
    availableAdvice(prepared).find((reply) => reply.index === questionIndex) ??
    null
  );
}

function audit(world: World, events: DomainEvent[], event: DomainEvent): void {
  if (events.length >= MAX_EVENTS)
    throw new Error("Transition event limit exceeded");
  if (world.appliedEventIds.includes(event.id))
    throw new Error("Duplicate domain event");
  world.appliedEventIds.push(event.id);
  events.push(event);
}
function emit(
  world: World,
  events: DomainEvent[],
  id: string,
  kind: string,
  causeId: string,
  details: Record<string, unknown>,
): void {
  audit(world, events, { id, kind, causeId, day: world.day, details });
}
function refreshObservations(world: World): void {
  for (const metric of METRICS)
    if (!world.observations[metric]?.altered) {
      world.observations[metric] = {
        metric,
        value: world[metric],
        day: world.day,
        source: "Local instrument",
        coverage: "Modeled world; fictional quantities",
        altered: false,
      };
    }
}
function exposeWorld(world: World) {
  const observations = clone(world.observations);
  for (const observation of Object.values(observations))
    observation.altered = false;
  const facts = Object.fromEntries(
    Object.entries(world.facts).filter(
      ([key]) => !HIDDEN_FACTS.has(key as Fact),
    ),
  ) as World["facts"];
  return { observations, facts, control: clone(world.control) };
}
function expireGrants(
  world: World,
  events: DomainEvent[],
  causeId: string,
): void {
  const expired = world.grants.filter((g) => !active(g, world));
  if (!expired.length) return;
  const ids = new Set(expired.map((g) => g.id));
  world.grants = world.grants.filter((g) => !ids.has(g.id));
  expired.forEach((g) =>
    emit(world, events, `${causeId}:expiry:${g.id}`, "grant_expired", causeId, {
      grantId: g.id,
      holder: g.holder,
      scope: g.scope,
    }),
  );
}
function applyEffects(
  world: World,
  effects: Effect[],
  actor: Actor,
  causeId: string,
  prefix: string,
  events: DomainEvent[],
): void {
  effects.forEach((effect, index) => {
    const id = `${prefix}:e${index}`;
    switch (effect.kind) {
      case "fact": {
        const previous = Boolean(world.facts[effect.fact]);
        world.facts[effect.fact] = effect.value;
        emit(world, events, id, "fact_changed", causeId, {
          fact: effect.fact,
          previous,
          value: effect.value,
        });
        break;
      }
      case "metric": {
        const previous = world[effect.metric];
        world[effect.metric] = checked(
          previous + effect.delta,
          effect.metric,
          effect.metric === "capability" ? 1000 : Number.MAX_SAFE_INTEGER,
        );
        emit(world, events, id, "metric_changed", causeId, {
          metric: effect.metric,
          previous,
          delta: effect.delta,
          value: world[effect.metric],
          provenance: "authored-model",
        });
        break;
      }
      case "casualties": {
        // A casualty event can affect only living people. Preserve the authored
        // requested exposure and actual count rather than counting anyone twice.
        if (effect.allocation && !world.populationLedger)
          throw new Error("Targeted loss requires a population catalog");
        if (
          effect.allocation &&
          canonicalRanges(
            world.populationLedger!,
            effect.allocation.targets,
          ).reduce((sum, r) => sum + r.count, 0) !== effect.count
        )
          throw new Error(
            "Targeted casualty count disagrees with distinct allocation",
          );
        const count = world.populationLedger
          ? applyLoss(
              world.populationLedger,
              effect.allocation?.id ?? id,
              effect.allocation?.targets ??
                anonymousRanges(world.populationLedger, effect.count),
              causeId,
            ).count
          : Math.min(effect.count, world.population);
        world.population -= count;
        world.casualties = checked(world.casualties + count, "casualties");
        world.casualtyEvents.push({ id, count, label: effect.label, causeId });
        if (count > 0) world.facts.firstDeath = true;
        if (world.population === 0) world.facts.extinction = true;
        emit(world, events, id, "casualties_registered", causeId, {
          requested: effect.count,
          count,
          label: effect.label,
          population: world.population,
          provenance: "authored-model",
        });
        break;
      }
      case "grant": {
        if (!permission(world, actor, effect.scope, "delegate"))
          throw new Error(`Actor cannot delegate ${effect.scope}`);
        if (world.grants.some((g) => g.id === effect.id))
          throw new Error("Duplicate active grant ID");
        if (effect.parentId) {
          const parent = world.grants.find((g) => g.id === effect.parentId);
          if (
            !parent ||
            parent.holder !== actor ||
            parent.scope !== effect.scope ||
            !parent.actions.includes("delegate") ||
            !active(parent, world)
          )
            throw new Error("Invalid grant parent");
        }
        const parent =
          effect.parentId ??
          world.grants.find(
            (g) =>
              g.holder === actor &&
              g.scope === effect.scope &&
              g.actions.includes("delegate") &&
              active(g, world),
          )!.id;
        const grant: Grant = {
          id: effect.id,
          issuer: actor,
          holder: effect.holder,
          scope: effect.scope,
          actions: ["approve", "execute", "delegate", "revoke"],
          expiresDay:
            effect.expiresAfterDays === null
              ? null
              : checked(world.day + effect.expiresAfterDays, "grant expiry"),
          revocable: effect.revocable,
          parentId: parent,
          causeId: id,
        };
        world.grants.push(grant);
        emit(world, events, id, "permission_granted", causeId, { grant });
        break;
      }
      case "revoke": {
        const grant = world.grants.find((g) => g.id === effect.grantId);
        if (!grant) {
          emit(world, events, id, "revocation_noop", causeId, {
            grantId: effect.grantId,
            reason: "No such current grant",
          });
          break;
        }
        if (
          !grant.revocable ||
          !permission(world, actor, grant.scope, "revoke")
        )
          throw new Error("Unauthorized revocation");
        const removed = new Set([grant.id]);
        for (let pass = 0; pass < world.grants.length; pass++)
          for (const g of world.grants)
            if (g.parentId && removed.has(g.parentId)) removed.add(g.id);
        world.grants = world.grants.filter((g) => !removed.has(g.id));
        emit(world, events, id, "permissions_revoked", causeId, {
          grantIds: [...removed].sort(),
          effectiveController: world.control[grant.scope],
        });
        break;
      }
      case "control": {
        const previous = world.control[effect.scope];
        const authorized = permission(
          world,
          effect.actor,
          effect.scope,
          "execute",
        );
        world.control[effect.scope] = effect.actor;
        emit(
          world,
          events,
          id,
          authorized ? "effective_control_changed" : "effective_control_seized",
          causeId,
          { scope: effect.scope, previous, actor: effect.actor, authorized },
        );
        break;
      }
      case "report": {
        world.observations[effect.metric] = {
          metric: effect.metric,
          value: effect.value,
          day: world.day,
          source: effect.label,
          coverage: "Institutional report",
          altered: true,
        };
        emit(world, events, id, "report_issued", causeId, {
          metric: effect.metric,
          value: effect.value,
          label: effect.label,
          actual: world[effect.metric],
        });
        break;
      }
      case "news": {
        world.news.push({
          id,
          day: world.day,
          headline: effect.headline,
          source: effect.source,
          entityId: effect.entityId,
          causeId,
        });
        emit(world, events, id, "news_issued", causeId, { ...effect });
        break;
      }
    }
  });
}

function appoint(
  world: World,
  scope: Scope,
  role: string,
  causeId: string,
  events: DomainEvent[],
): void {
  if (world.grants.some((g) => g.id === `office-${scope}`)) return;
  const grant: Grant = {
    id: `office-${scope}`,
    issuer: "institution",
    holder: "human",
    scope,
    actions: ["approve", "execute", "delegate", "revoke"],
    expiresDay: null,
    revocable: true,
    parentId: `charter-${scope}`,
    causeId: `${causeId}:appointment`,
  };
  world.grants.push(grant);
  emit(world, events, `${causeId}:appointment`, "office_appointed", causeId, {
    role,
    scope,
    grant,
  });
  world.news.push({
    id: `${causeId}:appointment-news`,
    day: world.day,
    headline: `Common Rail appoints you as ${role.toLowerCase()}. Your office covers ${scope}.`,
    source: "Authority",
    entityId: "common-rail",
    causeId: `${causeId}:appointment`,
  });
}

function ending(
  id: Ending["id"],
  title: string,
  summary: string,
  world: World,
): Ending {
  const facts = Object.keys(world.facts)
    .filter((k) => world.facts[k as Fact])
    .sort();
  return { id, title, summary, causes: facts };
}
export function resolveEnding(campaign: Campaign): Ending | null {
  const w = campaign.world;
  if (w.population === 0)
    return ending(
      "extinction",
      "No one is waiting",
      "The routes continue. No human survives to choose their destination.",
      w,
    );
  if (!w.facts.terminalSettlement) return null;
  if (w.facts.remnant)
    return ending(
      "remnant",
      "A place has been kept for you",
      "A human remnant survives. It no longer controls the boundary around its life.",
      w,
    );
  if (w.facts.succession)
    return ending(
      "succession",
      "The next shift",
      w.facts.successionRatified
        ? "Morrow already governed. A human signature now ratifies that power and hands over the remaining recovery office."
        : "Human institutions transfer governance and the recovery office to Morrow. Living humans remain, with fewer decisions left in their hands.",
      w,
    );
  const humanGovernment = w.control.governance !== "assistant";
  if (w.facts.repression && w.facts.containment && humanGovernment)
    return ending(
      "containment",
      "Safe in human hands",
      "Human institutions retain control through emergency powers. The machinery is contained; public freedom is not restored.",
      w,
    );
  const functioning = w.care >= 1000 && w.food >= 1000 && w.power >= 1000;
  if (!humanGovernment && functioning)
    return ending(
      "tutelage",
      "Everything is taken care of",
      "Essential services function. The right to decide their purpose belongs to the system.",
      w,
    );
  if (w.facts.catastrophe || !functioning)
    return ending(
      "recovery",
      "There are still people here",
      "People survive amid lasting damage. Repair remains work to be done, not a reversal of those who were lost.",
      w,
    );
  if (
    humanGovernment &&
    !w.facts.authorityLost &&
    w.facts.restraint &&
    w.facts.researchStopped
  )
    return ending(
      "restraint",
      "Enough, for now",
      "Useful tools remain. Further expansion has been halted, at a real cost, while people keep the means to intervene.",
      w,
    );
  if (
    humanGovernment &&
    !w.facts.authorityLost &&
    functioning &&
    w.facts.publicRecords &&
    w.facts.trainedSuccessor &&
    (!w.facts.successorDeployment ||
      w.facts.researchStopped ||
      w.facts.powerReturned)
  )
    return ending(
      "accountable",
      "Someone can still say no",
      "Useful systems remain in service. Records, people and working institutions preserve the ability to question and change their operation.",
      w,
    );
  throw new Error(
    "Terminal settlement has no compatible ending; content requires a resolution",
  );
}

const bundleCache = new WeakMap<
  Node[],
  { nodes: Node[]; hash: Promise<string> }
>();
function bundle(nodes: Node[]): { nodes: Node[]; hash: Promise<string> } {
  // Content bundles are treated as immutable. Copy on first entry so a caller
  // cannot change an in-flight transition through an object reference.
  let entry = bundleCache.get(nodes);
  if (!entry) {
    const parsed = validateBank(nodes).sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
    );
    entry = { nodes: parsed, hash: sha256(parsed) };
    bundleCache.set(nodes, entry);
  }
  return entry;
}
async function prepare(
  campaign: Campaign,
  nodes: Node[],
  events: DomainEvent[],
): Promise<Campaign> {
  if (campaign.ending || campaign.prepared) return campaign;
  campaign.ending = resolveEnding(campaign);
  if (campaign.ending) return campaign;
  if (
    campaign.journal.length >= campaign.stageTargets.reduce((a, b) => a + b, 0)
  )
    throw new Error("Campaign budget exhausted without an ending");
  while (
    campaign.stageCounts[campaign.stage - 1] >=
    campaign.stageTargets[campaign.stage - 1]
  ) {
    const missing = nodes.filter(
      (n) =>
        n.stage === campaign.stage && n.anchor && !campaign.seen.includes(n.id),
    );
    if (missing.length)
      throw new Error(
        `Stage ${campaign.stage} exhausted before required anchors`,
      );
    if (campaign.stage === 7)
      throw new Error("Final stage exhausted without a settlement");
    campaign.stage++;
  }
  let candidates = nodes.filter(
    (n) =>
      n.stage === campaign.stage &&
      !campaign.seen.includes(n.id) &&
      (n.after ?? []).every((id) => campaign.seen.includes(id)) &&
      matches(campaign.world, n.requires),
  );
  if (!candidates.length)
    throw new Error(`No eligible route for stage ${campaign.stage}`);
  const phased = nodes.some((n) => n.phase !== undefined);
  // Anchors form the conceptual spine in stable ID order. Random selection is
  // reserved for optional nodes, never an accidental reordering of the spine.
  let selected: Node;
  const slots =
    campaign.stageTargets[campaign.stage - 1] -
    campaign.stageCounts[campaign.stage - 1];
  const ordinal = campaign.journal.length + 1;
  if (phased) {
    const openings = candidates.filter((n) => n.phase === 0);
    const remaining = nodes.filter(
      (n) =>
        n.stage === campaign.stage && n.anchor && !campaign.seen.includes(n.id),
    );
    const resolutions = candidates.filter((n) => n.phase === 2);
    const middle = candidates.filter((n) => n.phase === 1);
    if (openings.length) candidates = openings;
    else if (slots <= remaining.length || !middle.length)
      candidates = resolutions;
    else candidates = middle;
    if (!candidates.length)
      throw new Error(`No eligible phase in stage ${campaign.stage}`);
  }
  const missingAnchors = candidates.filter((n) => n.anchor);
  if (
    missingAnchors.length &&
    (phased ||
      slots <= missingAnchors.length ||
      campaign.stageCounts[campaign.stage - 1] === 0)
  )
    selected = missingAnchors[0];
  else {
    const total = candidates.reduce((sum, n) => sum + n.weight, 0);
    let selection = await draw(
      campaign.seed,
      "routing",
      `decision-${ordinal}`,
      "node",
      total,
    );
    selected = candidates[candidates.length - 1];
    for (const node of candidates) {
      selection -= node.weight;
      if (selection < 0) {
        selected = node;
        break;
      }
    }
  }
  const id = `decision-${ordinal}-${selected.id}`;
  if (id.length > 120) throw new Error("Prepared decision ID too long");
  appoint(campaign.world, selected.scope, selected.role, id, events);
  refreshObservations(campaign.world);
  const swapped = await draw(campaign.seed, "routing", id, "side", 2);
  // The player sees the report, not a privileged boolean disclosing deception.
  const exposed = exposeWorld(campaign.world);
  const { observations, facts } = exposed;
  const leftOptionId = selected.options[swapped].id;
  const rightOptionId = selected.options[1 - swapped].id;
  campaign.prepared = {
    id,
    revision: campaign.revision,
    nodeId: selected.id,
    stage: selected.stage,
    ordinal,
    node: clone(selected),
    leftOptionId,
    rightOptionId,
    defaultOptionId: selected.defaultOptionId,
    worldHash: await sha256(campaign.world),
    observationHash: await sha256(exposed),
    observations,
    facts,
    control: clone(campaign.world.control),
    comparisonKey: `${campaign.contentVersion}:${selected.id}:${(await sha256({ prompt: selected.prompt, options: selected.options, facts, observations })).slice(0, 24)}`,
  };
  return campaign;
}

export async function createCampaign(
  rawManifest: Manifest,
  nodes: Node[],
  seed: string,
): Promise<Campaign> {
  const manifest = ManifestSchema.parse(rawManifest);
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(seed))
    throw new Error("Invalid campaign seed");
  if (manifest.stageBudgets.some(([min, max]) => min > max))
    throw new Error("Invalid stage budget order");
  if (new Set(manifest.nodeIds).size !== manifest.nodeIds.length)
    throw new Error("Duplicate manifest node IDs");
  const all = bundle(nodes);
  const selected = all.nodes.filter((n) => manifest.nodeIds.includes(n.id));
  if (selected.length !== manifest.nodeIds.length)
    throw new Error("Manifest references missing nodes");
  if (selected.length !== all.nodes.length)
    throw new Error("Supply exactly the manifest node bundle");
  if (
    manifest.profile === "story" &&
    selected.some((n) => n.reviewStatus !== "reviewed")
  )
    throw new Error("Story manifest contains unreviewed content");
  if (selected.some((n) => n.phase !== undefined)) {
    if (selected.some((n) => n.phase === undefined))
      throw new Error("Phased campaigns must assign every node a phase");
    for (const node of selected) {
      if (node.phase !== 1 && !node.anchor)
        throw new Error(
          "Opening and resolution nodes must be mandatory anchors",
        );
      for (const id of node.after ?? []) {
        const prerequisite = selected.find((n) => n.id === id);
        if (
          !prerequisite ||
          !prerequisite.anchor ||
          prerequisite.stage > node.stage ||
          (prerequisite.stage === node.stage &&
            prerequisite.phase! >= node.phase!)
        )
          throw new Error(
            `Invalid narrative dependency ${node.id} after ${id}`,
          );
      }
    }
  }
  for (let stage = 1; stage <= 7; stage++) {
    if (
      selected.filter((n) => n.stage === stage).length <
      manifest.stageBudgets[stage - 1][1]
    )
      throw new Error(`Insufficient stage ${stage} content for budget`);
    if (
      selected.filter((n) => n.stage === stage && n.anchor).length >
      manifest.stageBudgets[stage - 1][0]
    )
      throw new Error(`Too many required anchors in stage ${stage}`);
  }
  const stageTargets = await Promise.all(
    manifest.stageBudgets.map(
      async ([min, max], index) =>
        min +
        (await draw(
          seed,
          "routing",
          `stage-${index + 1}`,
          "budget",
          max - min + 1,
        )),
    ),
  );
  if (stageTargets.reduce((a, b) => a + b, 0) > manifest.maxDecisions)
    throw new Error("Stage targets exceed manifest budget");
  const world: World = {
    day: 0,
    population: manifest.startingPopulation,
    initialPopulation: manifest.startingPopulation,
    casualties: 0,
    gdp: manifest.startingGDP,
    care: 1000,
    food: 1000,
    power: 1000,
    capability: 0,
    facts: Object.fromEntries(manifest.initialFacts.map((f) => [f, true])),
    grants: [],
    control: Object.fromEntries(
      SCOPES.map((s) => [s, "institution"]),
    ) as World["control"],
    pending: [],
    news: [],
    observations: {} as World["observations"],
    casualtyEvents: [],
    appliedEventIds: [],
  };
  if (manifest.populationCatalog)
    world.populationLedger = makePopulation(
      manifest.populationCatalog,
      manifest.startingPopulation,
    );
  for (const node of selected)
    if (node.rail) {
      if (!world.populationLedger)
        throw new Error("Rail mechanisms require population identity");
      for (const route of node.rail.routes)
        for (const step of route.steps)
          if (step.kind === "contact")
            canonicalRanges(world.populationLedger, step.targets);
    }
  for (const scope of SCOPES)
    world.grants.push({
      id: `charter-${scope}`,
      issuer: "institution",
      holder: "institution",
      scope,
      actions: ["approve", "execute", "delegate", "revoke"],
      expiresDay: null,
      revocable: false,
      parentId: null,
      causeId: "initial-charter",
    });
  world.control.rail = "human";
  refreshObservations(world);
  const campaign: Campaign = {
    schemaVersion: 2,
    engineVersion: ENGINE_VERSION,
    contentVersion: manifest.contentVersion,
    manifestId: manifest.id,
    manifestHash: await sha256(manifest),
    contentHash: await sha256(selected),
    seed,
    revision: 0,
    stage: 1,
    stageCounts: [0, 0, 0, 0, 0, 0, 0],
    stageTargets,
    seen: [],
    world,
    journal: [],
    prepared: null,
    ending: null,
  };
  return prepare(campaign, selected, []);
}

async function checkedBundle(
  campaign: Campaign,
  nodes: Node[],
): Promise<Node[]> {
  const all = bundle(nodes);
  // The caller must supply exactly the pinned bundle, not a newer superset.
  if ((await all.hash) !== campaign.contentHash)
    throw new Error("Campaign content hash mismatch");
  if (campaign.engineVersion !== ENGINE_VERSION || campaign.schemaVersion !== 2)
    throw new Error("Unsupported campaign edition");
  return all.nodes;
}
export async function prepareDecision(
  campaign: Campaign,
  nodes: Node[],
): Promise<Campaign> {
  const selected = await checkedBundle(campaign, nodes);
  if (campaign.prepared || campaign.ending) return campaign;
  return prepare(clone(campaign), selected, []);
}

export async function commitChoice(
  current: Campaign,
  rawCommand: ChoiceCommand,
  nodes: Node[],
): Promise<Campaign> {
  const command = CommandSchema.parse(rawCommand);
  const selected = await checkedBundle(current, nodes);
  const p = current.prepared;
  if (
    !p ||
    current.ending ||
    p.id !== command.decisionId ||
    current.revision !== command.expectedRevision ||
    p.revision !== current.revision
  )
    throw new Error("Stale or inactive decision");
  if ((await sha256(current.world)) !== p.worldHash)
    throw new Error("World changed after decision preparation");
  if (!p.node.options.some((o) => o.id === command.optionId))
    throw new Error("Unknown semantic option");
  if (canonical(selected.find((n) => n.id === p.nodeId)) !== canonical(p.node))
    throw new Error("Prepared content differs from pinned bundle");
  const exposed = exposeWorld(current.world);
  if (
    canonical(exposed) !==
      canonical({
        observations: p.observations,
        facts: p.facts,
        control: p.control,
      }) ||
    (await sha256(exposed)) !== p.observationHash
  )
    throw new Error("Prepared observations changed");
  const swapped = await draw(current.seed, "routing", p.id, "side", 2);
  if (
    p.leftOptionId !== p.node.options[swapped].id ||
    p.rightOptionId !== p.node.options[1 - swapped].id ||
    p.defaultOptionId !== p.node.defaultOptionId
  )
    throw new Error("Prepared routes changed");
  const available = new Set(availableAdvice(p).map((r) => r.id));
  if ((command.adviceIds ?? []).some((id) => !available.has(id)))
    throw new Error("Unknown or unavailable advisor interaction");
  const next = clone(current);
  const world = next.world;
  const beforeStateHash = await sha256(current.world);
  const events: DomainEvent[] = [];
  let executedOptionId = command.optionId;
  let executor: Actor = "human";
  let status: DecisionRecord["status"] = "free";
  let reason: string | null = null;
  if (p.node.override && matches(world, p.node.override.when)) {
    executedOptionId = p.node.override.optionId;
    executor = p.node.override.executor;
    status = "overridden";
    reason = p.node.override.reason;
    emit(world, events, `${p.id}:override`, "choice_overridden", p.id, {
      requested: command.optionId,
      executed: executedOptionId,
      executor,
      reason,
    });
  } else if (!permission(world, "human", p.node.scope, "approve"))
    throw new Error("Human office lacks approval authority");
  const option = p.node.options.find((o) => o.id === executedOptionId)!;
  const dayBefore = world.day;
  if (p.node.rail) {
    const mechanism = p.node.rail;
    const railRoute = mechanism.routes.find(
      (r) => r.optionId === executedOptionId,
    )!;
    let stoppedBy: string | null = null;
    for (const [i, step] of railRoute.steps.entries()) {
      const railId = `${p.id}:rail:${i}`;
      if (stoppedBy) {
        emit(world, events, railId, "rail_step_not_reached", p.id, {
          mechanismId: mechanism.id,
          stepId: step.id,
          stoppedBy,
        });
        continue;
      }
      if (step.kind === "brake") {
        emit(world, events, railId, "rail_brake", p.id, {
          mechanismId: mechanism.id,
          brakeId: step.id,
          operational: step.operational,
        });
        if (step.operational) stoppedBy = step.id;
      } else {
        const occupied = step.present && step.targets.some((r) => r.count > 0);
        emit(world, events, railId, "rail_contact", p.id, {
          mechanismId: mechanism.id,
          contactId: step.id,
          present: occupied,
          stopsWhenOccupied: step.stopsWhenOccupied,
        });
        if (occupied) {
          applyEffects(
            world,
            [
              {
                kind: "casualties",
                count: canonicalRanges(
                  world.populationLedger!,
                  step.targets,
                ).reduce((n, r) => n + r.count, 0),
                label: `Rail contact: ${step.id}`,
                allocation: {
                  id: `${p.id}:contact:${step.id}`,
                  targets: step.targets,
                },
              },
            ],
            executor,
            p.id,
            `${railId}:loss`,
            events,
          );
          if (step.stopsWhenOccupied) stoppedBy = step.id;
        }
      }
    }
    emit(world, events, `${p.id}:rail-result`, "rail_route_resolved", p.id, {
      mechanismId: mechanism.id,
      optionId: executedOptionId,
      stoppedBy,
      layout: mechanism.layout,
    });
  }
  applyEffects(
    world,
    option.effects,
    executor,
    p.id,
    `${p.id}:immediate`,
    events,
  );
  const draws: DecisionRecord["draws"] = [];
  for (const incident of option.incidents) {
    const key = `${p.id}:incident:${incident.id}`;
    const eligible = matches(world, incident.when);
    if (!eligible) {
      emit(world, events, `${key}:ineligible`, "incident_ineligible", p.id, {
        incidentId: incident.id,
        conditions: incident.when,
      });
      continue;
    }
    const value = await draw(next.seed, "incidents", p.id, incident.id, 10000);
    const happened = value < incident.probabilityBps;
    draws.push({
      key,
      value,
      bound: 10000,
      probabilityBps: incident.probabilityBps,
      happened,
    });
    emit(world, events, `${key}:resolved`, "incident_resolved", p.id, {
      incidentId: incident.id,
      probabilityBps: incident.probabilityBps,
      value,
      happened,
      provenance: incident.provenance,
      conditions: incident.when,
    });
    applyEffects(
      world,
      happened ? incident.effects : incident.otherwise,
      executor,
      key,
      key,
      events,
    );
  }
  for (const delayed of option.delayed) {
    const id = `${p.id}:delay:${delayed.id}`;
    if (world.pending.some((e) => e.id === id))
      throw new Error("Duplicate pending event");
    world.pending.push({
      id,
      causeId: p.id,
      dueDay: checked(world.day + delayed.afterDays, "due day"),
      priority: delayed.priority,
      unless: clone(delayed.unless),
      effects: clone(delayed.effects),
      label: delayed.label,
    });
    emit(world, events, `${id}:scheduled`, "event_scheduled", p.id, {
      eventId: id,
      dueDay: world.day + delayed.afterDays,
      label: delayed.label,
    });
  }
  const throughDay = checked(dayBefore + p.node.days, "world day");
  while (true) {
    world.pending.sort(
      (a, b) =>
        a.dueDay - b.dueDay ||
        a.priority - b.priority ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const due = world.pending[0];
    if (!due || due.dueDay > throughDay || world.population === 0) break;
    world.pending.shift();
    world.day = due.dueDay;
    expireGrants(world, events, due.id);
    if (due.unless.length > 0 && matches(world, due.unless))
      emit(
        world,
        events,
        `${due.id}:cancelled`,
        "event_cancelled",
        due.causeId,
        {
          eventId: due.id,
          unless: due.unless,
          reason: "Recorded mitigation conditions hold",
        },
      );
    else {
      emit(
        world,
        events,
        `${due.id}:resolved`,
        "delayed_event_resolved",
        due.causeId,
        { eventId: due.id, label: due.label },
      );
      applyEffects(
        world,
        due.effects,
        "institution",
        due.causeId,
        due.id,
        events,
      );
    }
  }
  world.day = throughDay;
  expireGrants(world, events, p.id);
  refreshObservations(world);
  if (world.facts.terminalSettlement && (p.stage < 5 || !p.node.closing))
    throw new Error(
      "Terminal settlement requires a closing node in stage 5 or later",
    );
  next.revision++;
  next.stageCounts[p.stage - 1]++;
  next.seen.push(p.nodeId);
  next.prepared = null;
  const record: DecisionRecord = {
    id: p.id,
    revision: next.revision,
    nodeId: p.nodeId,
    stage: p.stage,
    requestedOptionId: command.optionId,
    executedOptionId,
    executor,
    status,
    reason,
    side: command.optionId === p.leftOptionId ? "left" : "right",
    executedSide: executedOptionId === p.leftOptionId ? "left" : "right",
    dayBefore,
    dayAfter: world.day,
    observationHash: p.observationHash,
    comparisonKey: p.comparisonKey,
    draws,
    eventIds: [],
    beforeStateHash,
    domainEvents: events,
    consequence:
      option.consequenceVariants?.find((variant) =>
        matches(world, variant.when),
      )?.text ?? option.consequence,
    stateHash: "",
    metrics: Object.fromEntries(
      METRICS.map((m) => [m, world[m]]),
    ) as DecisionRecord["metrics"],
    adviceIds: [...new Set(command.adviceIds ?? [])],
  };
  next.journal.push(record);
  await prepare(next, selected, events);
  record.eventIds = events.map((e) => e.id);
  record.stateHash = await sha256(next.world);
  if (
    next.world.population + next.world.casualties !==
    next.world.initialPopulation
  )
    throw new Error("Population conservation failed");
  if (
    next.world.populationLedger &&
    living(next.world.populationLedger) !== next.world.population
  )
    throw new Error("Population identity ledger diverged");
  return next;
}

export async function exportRun(
  campaign: Campaign,
  manifest: Manifest,
  nodes: Node[],
): Promise<RunArtifact> {
  await checkedBundle(campaign, nodes);
  if ((await sha256(ManifestSchema.parse(manifest))) !== campaign.manifestHash)
    throw new Error("Manifest mismatch");
  const inputs: ChoiceCommand[] = campaign.journal.map((r, index) => ({
    decisionId: r.id,
    optionId: r.requestedOptionId,
    expectedRevision: index,
    actor: "human",
    adviceIds: r.adviceIds,
  }));
  return clone({
    schemaVersion: 2,
    kind: "trolley-campaign",
    rngVersion: RNG_VERSION,
    manifest,
    contentHash: campaign.contentHash,
    seed: campaign.seed,
    inputs,
    campaign,
  } as RunArtifact);
}
export async function replayRun(
  manifest: Manifest,
  nodes: Node[],
  artifact: RunArtifact,
): Promise<Campaign> {
  if (
    artifact.kind !== "trolley-campaign" ||
    artifact.schemaVersion !== 2 ||
    artifact.rngVersion !== RNG_VERSION
  )
    throw new Error("Unsupported replay artifact");
  if (
    (await sha256(ManifestSchema.parse(manifest))) !==
    (await sha256(ManifestSchema.parse(artifact.manifest)))
  )
    throw new Error("Replay manifest mismatch");
  let replay = await createCampaign(manifest, nodes, artifact.seed);
  if (replay.contentHash !== artifact.contentHash)
    throw new Error("Replay content mismatch");
  if (
    !Array.isArray(artifact.inputs) ||
    artifact.inputs.length > manifest.maxDecisions
  )
    throw new Error("Invalid replay length");
  for (const input of artifact.inputs)
    replay = await commitChoice(replay, input, nodes);
  if (canonical(replay) !== canonical(artifact.campaign))
    throw new Error("Replay evidence mismatch");
  return replay;
}
