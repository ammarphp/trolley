# CR003 — identity, rail causality and institution-owned events

Status: proposal for coordinator review. No shared contract or application code changes are authorized by this document. It is the next dependency for the full model, not a claim that G1 has passed.

This proposal addresses F01, F03 and F04 in [the semantic fixture specification](../../research/fixtures-spec.json). It builds on the actual v2 contracts and reducer, and the gaps recorded in [fixture coverage](../../reports/validation/fixture-coverage.md). Keep the vanilla application, pure reducer, keyed RNG, atomic journal and existing renderer boundary. Introduce a new simulation edition instead of changing the meaning of existing saved runs.

## 1. What must change

The present casualty effect specifies a count. Its application ID is generated from a transition prefix and effect index. Capping that count at the surviving population prevents negative population, but cannot establish that two different effects did not kill the same people twice.

The current loop node stipulates an outcome through casualty effects. There is no executable obstruction or brake mechanism against which to test removing the person.

Pending events have no institutional owner. They execute as the generic institution actor, even though a story may say that their administering institution dissolved. A generic actor or a changed news headline is not institutional succession.

Add three small domain modules:

1. A population ledger, with sparse identifiable fictional people and compressed anonymous population sets.
2. A bounded, deterministic rail mechanism whose contacts and stopping rules produce casualty allocations.
3. Named institutions and stable obligations whose owner can change without changing the obligation or its original cause.

Do not add an alignment meter, general physics engine, arbitrary scripting, demographic scoring, player identity or a replacement UI framework.

## 2. Edition boundary and compatibility

Proposed version identifiers are schemaVersion 3, engineVersion 3.0.0 and contentVersion 3.0.0-foundation.1. The first new manifest has profile test. The version bump denotes an incompatible domain contract, not completion of the full campaign. The established sha256-counter-v1 algorithm can remain unchanged.

Before implementing the new edition:

- Freeze the current v2 contracts, simulation, RNG, content and manifest under a complete edition directory, for example src/editions/v2_0_0/. Preserve their relative import tree and canonical bundle hashes. Keep their dependency versions pinned.
- Record representative complete and partial v2 artifacts, including the existing eight ending witnesses. Record the source-file digests as well as the manifest/content hashes.
- Add the new modules under src/contracts/v3/ and src/simulation/v3/. An edition registry dispatches by the exact schema version, engine version, manifest hash and content hash. Unknown combinations fail with an export/read-only recovery path.
- Retain the old reducer and old bundle. Do not pass a v2 save through a v3 parser that supplies empty extension fields, renumbers events, creates people from casualty totals or assigns historical institutional owners.
- A saved run resumes only in its pinned edition. Choosing the new edition starts a new run and a new collection context. No fabricated causal history or retrospective upload is permitted.

The active slice stays on its existing edition until an explicitly reviewed new manifest replaces it. Content hashing in v3 covers nodes, population definitions, rail definitions, institutions and obligation definitions. Old static and collector replay allowlists must remain able to select their exact v2 bundle. Never silently replay an old run against the latest source tree.

## 3. One population ledger, two kinds of presentation

Use stable accounting cohorts with integer slots. A named local person is an alias for one slot, not an extra person added to the cohort count. Cohorts are disjoint partitions of the declared modeled population. They are not overlapping demographic categories or automatically changing geographic regions.

All person aliases and cohort sizes are declared before the run. A person can be introduced to the player later, but their population membership must already exist. CR003 does not add births, cloning, resurrection, immigration or dynamic promotion of anonymous people into the catalog.

~~~ts
type Id = string; // Existing bounded Identifier rules; IDs are namespaced by kind.
type PersonId = Id;
type CohortId = Id;
type SiteId = Id;
type Range = readonly [startInclusive: number, endExclusive: number];

interface CohortDefinition {
  id: CohortId;
  label: string;
  initialCount: number; // Nonnegative safe integer.
}
interface PersonDefinition {
  id: PersonId;
  label: string; // May be 'the siding worker'; a proper name is not required.
  cohortId: CohortId;
  slot: number;
  initialSiteId: SiteId | null;
}
interface SiteDefinition { id: SiteId; label: string }
interface CohortState {
  deadRanges: Range[]; // Sorted, disjoint, adjacent ranges merged.
}
interface PersonState {
  siteId: SiteId | null; // Physical presence, not life status.
}
type PopulationSelector =
  | { kind: 'person'; personId: PersonId }
  | { kind: 'cohort-ranges'; cohortId: CohortId; ranges: Range[] }
  | { kind: 'whole-cohort'; cohortId: CohortId }
  | { kind: 'whole-world' };
~~~

Catalog validation requires unique person IDs and an injective mapping from persons to cohort/slot pairs. Each slot lies within its cohort. A person's label is never an identity key. Sites are a separate finite catalog: moving between sites does not create a person or change their accounting cohort.

For cohort i with initial size N, dead-slot union D and named-alias slot set A:

- Living named people = the cardinality of A minus D.
- Living anonymous people = N minus the cardinality of D minus living named people.
- Total living people = N minus the cardinality of D.

Sum the final expression across cohorts. World.population and World.casualties may remain cached numbers for the UI, but every transition verifies them against the ledger and initialPopulation. Never add named survivors to the full cohort survivor count.

This representation does not allocate billions of objects. A world loss can be one interval per cohort. The slots are fictional accounting identities, not claims to know the identity of real people in an aggregate. No uniform sampling is implied by taking a range.

### Physical loss identity

Separate a physical occurrence, a loss allocation within that occurrence, and an application or report that references it.

~~~ts
interface LossAllocation {
  id: Id;
  physicalEventId: Id;
  targets: PopulationSelector[];
  label: string;
}
interface LossReceipt {
  allocationId: Id;
  physicalEventId: Id;
  payloadHash: string;
  targetRanges: Record<CohortId, Range[]>;
  newlyDeadRanges: Record<CohortId, Range[]>;
  previouslyDeadRanges: Record<CohortId, Range[]>;
  newlyDeadCount: number;
  causeIds: CauseRef[];
  day: number;
}
type CauseRef =
  | { kind: 'decision'; id: Id }
  | { kind: 'event'; id: Id }
  | { kind: 'initialization'; manifestHash: string };
~~~

The engine creates occurrence/allocation IDs from stable content keys and the initiating decision or scheduled event. It stores the resolved IDs for later references. A later observer must reuse that reference, not regenerate identity from its own effect index. Separate occurrences get separate IDs even if their descriptions match.

Applying a loss is an atomic set operation:

1. Resolve person aliases and whole-cohort/world selectors to normalized cohort ranges. Union overlapping selectors before counting.
2. Reject unknown references, out-of-bounds ranges and unsafe arithmetic. There is no implicit debit from an unspecified global anonymous pool.
3. If the allocation ID already exists with the same canonical payload, record an idempotent reference and add no deaths. A different payload under that ID rejects the entire transaction.
4. Subtract the cohort's existing dead ranges from the target ranges. Only that difference adds deaths. Keep the overlap in the receipt.
5. Union the new deaths into the ledger, derive life status and population, and append the receipt. A different physical event hitting an already-dead person adds zero deaths.

Thus two allocations with different IDs can still overlap without double counting people. The ledger provides that protection, independently of event-ID deduplication. First recorded lethal cause is a simulation ordering result; it is not a claim about moral responsibility or every sufficient cause.

In v3, the old bare casualties/count effect is invalid. Authors must declare which population set a mass count concerns. Do not automatically migrate old counts into arbitrary slot ranges. Whole-world events explicitly include every named alias and anonymous member; they cannot leave all recurring characters alive by accident.

### Population example

Declare a local cohort of seven slots: six people on the tracks and one off-track fictional operator. Give the six track participants aliases p1–p6. The operator may remain an anonymous member for this fixture; this does not implement a distinct human-authority principal. The rest of the modeled world belongs to another disjoint cohort.

Keeping course targets p1–p5. Diverting targets p6. In separate runs, the survivor sets are therefore exact, even though the application still reports a simple count. A later whole-world loss includes the previously dead slots, but adds only the people still living.

For a mass-loss fixture, use cohorts with 100 and 900 members. Alias two people inside the first cohort. Target ranges must explicitly include or exclude their slots. The reported total never adds those aliases a second time.

## 4. Bounded rail causality for the switch and loop

Add an atomic traversal over a small acyclic causal graph. This is a stipulated fictional mechanism, not realistic collision physics or a moral scoring rule. Animation and drawn curvature cannot change it.

~~~ts
interface BrakeDefinition {
  id: Id;
  mechanismId: Id;
  initiallyOperational: boolean;
}
type StopRule =
  | { kind: 'contact-this-traversal'; contactStepId: Id; personId: PersonId }
  | { kind: 'operational-brake'; brakeId: Id };
type RailStep =
  | { id: Id; kind: 'contact'; siteId: SiteId; next: Id }
  | { id: Id; kind: 'stop-if'; rule: StopRule; otherwise: Id }
  | { id: Id; kind: 'exit' };
interface RailMechanismDefinition {
  id: Id;
  steps: RailStep[];
  routes: { id: Id; entryStepId: Id }[];
  brakes: BrakeDefinition[];
}
interface RailTraversalReceipt {
  id: Id;
  mechanismId: Id;
  routeId: Id;
  definitionHash: string;
  stepEventIds: Id[];
  stopWitnessEventId: Id | null;
  exited: boolean;
}
~~~

New narrow effects have the following exact payloads:

~~~ts
type RailEffectV3 =
  | { kind: 'place-person'; personId: PersonId; siteId: SiteId | null }
  | { kind: 'set-brake'; mechanismId: Id; brakeId: Id; operational: boolean }
  | { kind: 'traverse-rail'; mechanismId: Id; routeId: Id; occurrenceKey: Id };
~~~

Each produces a causal receipt. The first two change a declared site's occupancy or brake state; they never change population directly. They require the authored rail jurisdiction and are unavailable as arbitrary field mutations. A traversal ID combines its initiating cause with occurrenceKey. Reusing that pair with the same definition and route is idempotent; a changed payload rejects. Contact allocation IDs combine the stored traversal ID with the contact step ID.

A contact step examines all cataloged people physically present at its site, in stable ID order. It records contact, including whether each person was already dead, and creates one loss allocation for the contacted people. It must not silently exclude an inconvenient occupant through a presentation filter.

A stop rule reads only a contact recorded in this traversal or the current state of its named brake. It cannot borrow a contact from a previous dilemma. Contact-based rules must reference a preceding contact step that dominates the stopping step on the relevant route. A successful stop ends traversal; a failed stop takes the declared next edge. There is no time or RNG advance inside a traversal.

Life and physical presence are separate. Death does not make an obstruction vanish. A body still present can be contacted and stop the trolley while adding zero deaths; removing it changes presence. Ordinary F01/F03 nodes require their intended participants to be alive before preparation. A postmortem or absence variant must be explicitly authored, not rendered as the original living-person scene.

Validate route references, brake references, finite acyclic traversal and terminal reachability. A visual loop can be a route that rejoins a later causal step; it need not be a computational cycle.

For a rail-bound option, the rail loss allocations come from traversal. Reject additional direct loss allocations purporting to describe the same rail occurrence. A separately authored simultaneous disaster must have its own cause and remain distinguishable in the debrief.

### Matched golden mechanisms

Both mechanisms use the same track drawing and the same initial sites:

~~~text
main route: contact main site (p1–p5) -> exit
side route: contact siding site (p6) -> stop-if -> contact main site -> exit

Mechanism A stop-if:
  contact-this-traversal(siding-contact, p6)

Mechanism B stop-if:
  operational-brake(independent-brake), initially true
~~~

With p6 present, taking the side route kills p6 and saves p1–p5 in both cases. Moving p6 off the siding changes the result:

| Intervention | Mechanism A | Mechanism B |
| --- | --- | --- |
| Keep main route | p1–p5 die | p1–p5 die |
| Side route, p6 present | p6 dies; contact stops trolley | p6 dies; independent brake stops trolley |
| Side route, p6 removed | p1–p5 die; nothing stops trolley | Nobody dies; independent brake stops trolley |
| Side route, brake disabled | Unchanged; no brake dependency | p6 and p1–p5 die |

These are interventions in cloned fixture initial states, never edits to committed history. A stop witness establishes the actual stopping cause. A claim that the person was necessary to rescue also requires the removal counterfactual; a contact alone does not establish necessity if another downstream brake would rescue everyone anyway.

The accessible scene description must derive the relevant rule and observed occupancy from the prepared mechanism projection. It identifies the independent brake or the obstruction dependence even without an image. Debrief copy calls this a loop adaptation, not a Footbridge replication or an experimentally established moral verdict. A renderer integration test, not a contract comment, must verify that description.

## 5. Named institutions and persistent obligations

Keep the human and assistant actor classes for now. Replace the generic institution principal in new-edition authority fields with an ID-bearing principal. This is enough to distinguish an agency from its successor without claiming a complete person-level succession model.

~~~ts
type Principal =
  | { kind: 'human' }
  | { kind: 'assistant' }
  | { kind: 'institution'; institutionId: Id };

interface InstitutionDefinition { id: Id; label: string }
interface InstitutionState {
  status: 'active' | 'dissolved';
  dissolvedDay: number | null;
  dissolutionEventId: Id | null;
}

type OwnerLossPolicy =
  | { kind: 'cancel'; reason: string }
  | { kind: 'fail'; reason: string }
  | {
      kind: 'transfer'; successorId: Id;
      ifUnavailable: 'cancel' | 'fail'; reason: string;
    };
interface Obligation {
  id: Id;
  originalOwnerId: Id;
  currentOwnerId: Id;
  requiredScope: Scope;
  originCause: CauseRef;
  createdDay: number;
  dueDay: number;
  priority: number;
  ownerLossPolicy: OwnerLossPolicy;
  dueConditions: PredicateV3[];
  fulfillmentEffects: OwnerEffectV3[];
  failureEffects: PhysicalEffectV3[];
  status: 'pending' | 'fulfilled' | 'cancelled' | 'failed';
  terminalEventId: Id | null;
}
~~~

Grant issuer/holder, effective controller and actual executor use Principal in v3. Human/assistant presentation classes are derived from it. An institution ID must resolve even after dissolution: keep a tombstone instead of deleting its history or reusing its ID.

Grants issued by or held by an inactive institution become inactive; dependent parent chains do too. A successor must obtain a valid independent authority chain. Renaming an agency or transferring its duties cannot keep alive a grant rooted only in the dissolved issuer. Legal revocation still does not magically reverse a recorded seizure of effective control.

Use the existing strict fact, non-population metric, news and report payloads unchanged. The following replacements/additions define the new effect and predicate scope; BasePredicate and BaseEffect below mean those frozen structural payloads, not imports that may change beneath this edition.

~~~ts
type PhysicalEffectV3 =
  | Extract<BaseEffect, { kind: 'fact' | 'metric' | 'news' | 'report' }>
  | { kind: 'population-loss'; allocation: LossAllocation };
type AuthorityEffectV3 =
  | (Omit<Extract<BaseEffect, { kind: 'grant' }>, 'holder'> & { holder: Principal })
  | Extract<BaseEffect, { kind: 'revoke' }>
  | { kind: 'control'; scope: Scope; principal: Principal };
type OwnerEffectV3 = PhysicalEffectV3 | AuthorityEffectV3 | RailEffectV3;
type PredicateV3 =
  | Exclude<BasePredicate, { kind: 'control' }>
  | { kind: 'control'; scope: Scope; principal: Principal }
  | { kind: 'person-life'; personId: PersonId; alive: boolean }
  | { kind: 'person-site'; personId: PersonId; siteId: SiteId | null }
  | { kind: 'cohort-living'; cohortId: CohortId; op: 'gte' | 'lte' | 'eq'; value: number }
  | { kind: 'institution-status'; institutionId: Id; status: 'active' | 'dissolved' };
~~~

cohort-living values are nonnegative safe integers. Unknown referenced entities reject at bundle validation; they do not make a predicate quietly false. A grant still records its actual executing issuer, now as Principal. Owner effects require the executing owner's named scope and normal grant checks. Their list cannot recursively create obligations or change institutions: lifecycle operations are a separate top-level effect type below.

PhysicalEffectV3 cannot issue/revoke grants, move a person, transfer obligations or mutate institutional status. Failure consequences act through their recorded causal event, never by pretending a dissolved agency executed a new instruction. Physical fact changes cannot bypass typed population, institution or authority operators: a narrative authorityLost flag neither creates nor removes actual rights. All predicates remain separate from the public observation/advice projection.

### Event types and lifecycle operations

Replace the unowned v3 delay with an explicit union:

~~~ts
type ScheduledEventV3 =
  | {
      id: Id; kind: 'physical'; dueDay: number; priority: number;
      cause: CauseRef; unless: PredicateV3[]; effects: PhysicalEffectV3[];
    }
  | {
      id: Id; kind: 'obligation-due'; dueDay: number; priority: number;
      obligationId: Id;
    }
  | {
      id: Id; kind: 'institution-transition'; dueDay: number; priority: number;
      cause: CauseRef; executor: Principal;
      action: DissolveInstitution | TransferObligation;
    };
type DissolveInstitution = { kind: 'dissolve-institution'; institutionId: Id };
type TransferObligation = { kind: 'transfer-obligation'; obligationId: Id; successorId: Id };
type ObligationDraft = Omit<Obligation,
  'originalOwnerId' | 'currentOwnerId' | 'originCause' | 'createdDay' |
  'status' | 'terminalEventId'> & { ownerId: Id };
type EffectV3 = OwnerEffectV3 | DissolveInstitution | TransferObligation
  | { kind: 'create-obligation'; obligation: ObligationDraft };
~~~

These types are references to the authoritative obligation, not captured copies of its original owner. The due-event ID and obligation ID survive transfer. Due date, original cause, fulfillment payload, prior history and already-realized losses do not change.

Add create-obligation, transfer-obligation and dissolve-institution effects. The engine derives original/current ownership from ownerId and derives the cause and creation day from the executing transaction. Creation requires an active owner with the named scope and a dueDay strictly after the current day. Its due event is scheduled once; the catalog's stable duty key plus initiating cause identifies the obligation. Neither content nor a replay may supply a pre-fulfilled duty. Dissolution requires currently enforceable governance authority. A manual transfer requires either the active owner's delegation right for that scope or currently enforceable governance authority.

A successor is valid only if it exists, is active, has an active execute grant for requiredScope, and holds effective control of that scope at the transfer boundary. This first contract models direct institutional performance. It does not infer enforceability from a service contract, a friendly assistant or an unexplained delegation chain.

The transfer operation itself creates no grant and moves no controller. Those changes, if needed, must be explicit earlier effects of the same authorized transaction. A failed authorization or unknown successor in a requested manual transfer rejects the transaction. An automatic owner-loss policy with an unavailable successor follows its declared cancel/fail fallback.

Dissolution immediately reconciles every pending obligation currently owned by that institution, in stable obligation-ID order:

- Cancel marks it cancelled, records the reason and removes its pending due entry.
- Fail marks it failed, records the reason and applies its declared physical failure effects exactly once.
- Transfer validates the declared successor and changes only current ownership, or applies the specified fallback.

Terminal obligations are immutable. Cancellation is not fulfillment and does not erase past harms. A completed duty cannot be cancelled retroactively. Repeated delivery of a terminal due-event reference contributes no second effects and emits an idempotent-reference receipt.

At a due boundary, an active owner must still have the execute grant, effective control and declared due conditions. Otherwise the obligation fails with a specific reason such as owner-inactive, authority-expired, control-lost or conditions-unmet. Expired authority cannot be borrowed from the scheduling-time snapshot.

### Same-day order

Keep immediate effects before incidents, then scheduling and authored time advance. Immediate dissolution/transfer is processed in declared effect order and reconciles ownership immediately.

For each reached fictional day, use the following fixed phases, then priority and stable event ID within a phase:

1. Expire grants.
2. Execute scheduled institutional transitions, checking their executor's current authority. Reconcile affected ownership immediately after each transition.
3. Resolve due obligations against their current owner.
4. Resolve physical delayed events; nonempty cancellation conditions are evaluated at resolution.

A denied scheduled institutional transition is recorded as denied and changes no institution or duty. Other due work still resolves under the actual resulting state. A requested immediate unauthorized transition instead rejects the player's whole atomic commit.

This makes dissolution precede a duty due on the same day; content must declare a later day if completion is meant to precede closure. The ordering is authored game semantics, not a claim about real legal deadlines. An earlier physical hazard can be scheduled on an earlier day. It cannot be moved ahead of lifecycle resolution through an undocumented numeric-priority trick.

Only already committed causes or earlier events in the transaction can be parents of a new causal receipt. Reject causal-reference cycles. Ownership transfer does not rewrite parentage.

### Institutional golden example

County, Old Dispatch and New Dispatch are distinct institution IDs. County holds enforceable governance authority and a separate valid food delegation grant. An active food grant from County gives Old Dispatch food execution authority; Old Dispatch holds effective food control. New Dispatch initially has no food power. Governance alone is not an implicit food grant.

The canonical F04 fixture is an exclusion order: Old Dispatch is scheduled to deny a declared settlement cohort its next delivery on day 2. Its fulfillment causes a declared physical loss allocation against 20 settlement members. Its cancel policy causes no additional deaths. Fulfilled means the institution carried out the order; it does not mean the order was helpful or morally permissible.

On the day-2 boundary:

| Choice/setup | Required event sequence and result |
| --- | --- |
| Transfer | County issues New Dispatch an independent food grant; transfers food control; transfers the same exclusion order; dissolves Old Dispatch. The original due event resolves once under New Dispatch; exactly the declared 20 still-living recipients die. |
| Close, cancel policy | County dissolves Old Dispatch without transfer. The order is cancelled with its declared reason. No ghost exclusion occurs; the 20 people remain alive unless a separate cause affects them. |
| Close, fail policy | A separately authored service-delivery fixture marks a needed delivery failed on dissolution. Its declared physical failure allocation executes once; Old Dispatch is not recorded as a living executor. |
| Invalid successor | A requested transfer to a nonexistent, dissolved, powerless or ineffective successor rejects atomically. No partial closure or invented authority remains. |
| Automatic transfer unavailable | The stored owner-loss rule follows its declared cancel/fail fallback, preserving the original cause and due history. |
| Already fulfilled | Later dissolution leaves the fulfillment and its consequences intact. |

A supplementary positive duty uses the same lifecycle to deliver food, increasing capacity by 10 authored units when fulfilled and causing a declared 20-person loss when it fails. It prevents the implementation from hard-coding cancellation as either helpful or harmful. Neither fixture claims a full inventory or physiology model.

## 6. Transaction, projection and boundedness

### Exact container changes

The bundle gains immutable population/site/rail/institution catalogs plus explicit initial grants and scope controllers. Those initial principals and every catalog cross-reference validate before campaign creation. The sum of cohort sizes must equal startingPopulation. Catalog order is canonicalized for hashing; display labels do not establish identity. The initial state contains no deaths or completed obligations.

~~~ts
interface WorldIdentityExtensionV3 {
  cohorts: Record<CohortId, CohortState>;
  people: Record<PersonId, PersonState>;
  losses: Record<Id, LossReceipt>; // Keyed by allocationId.
  brakes: Record<Id, Record<Id, boolean>>; // mechanismId -> brakeId -> operational.
  traversals: Record<Id, RailTraversalReceipt>;
  institutions: Record<Id, InstitutionState>;
  obligations: Record<Id, Obligation>;
}
type GrantV3 = Omit<BaseGrant, 'issuer' | 'holder' | 'causeId'> & {
  issuer: Principal; holder: Principal; cause: CauseRef;
};
type WorldV3 = Omit<BaseWorld,
  'grants' | 'control' | 'pending' | 'casualtyEvents'> & WorldIdentityExtensionV3 & {
  grants: GrantV3[];
  control: Record<Scope, Principal>;
  pending: ScheduledEventV3[];
};
interface DomainEventV3 {
  id: Id;
  kind: string; // Validate against the new edition's finite event-kind registry.
  causes: CauseRef[];
  day: number;
  executor: Principal | null; // null for physical resolution, never a ghost institution.
  details: Record<string, unknown>; // Per-kind strict validated payload.
}
~~~

BaseWorld/BaseGrant denote frozen structural definitions. World.casualtyEvents is replaced by losses, not maintained as a second mutable casualty ledger. Existing scalar population/casualties fields become checked ledger projections. DecisionRecord.executor and PreparedDecision.control use Principal; their domainEvents use DomainEventV3. A physical loss receipt links to a loss allocation and its causal event; an obligation receipt includes obligationId, old/new owner where applicable, status, due-event ID and reason. Numeric display/report observations remain a separate projection.

PreparedDecision also gains observedPeople, observedMechanisms and observedInstitutions as explicit scene projections. Each entry contains only disclosed catalog identity and observed state, with unknown represented explicitly. A person entry uses life: 'alive' | 'dead' | 'unknown'; an institution entry uses status: 'active' | 'dissolved' | 'unknown'. Mechanism projections expose the authored accessible description, observed occupancy and disclosed stopping rule. They do not expose raw loss ranges, undisclosed locations or the full obligation registry. Define their final renderer payloads with the renderer owner; no additional world access is permitted as a shortcut. Their canonical material fields participate in observationHash and the comparison context.

Retain immutable input, expected revision, pinned content, independent RNG domains and one atomic journal envelope. Do not make animations, wall-clock waits, advice queries or uploads execute any of the new operators.

Before publishing the next prepared decision:

- Recompute population invariants and ensure every reference resolves.
- Stop human decision continuation at zero survivors, regardless of output or institutional reports.
- Verify any person presented as a living participant is alive and at the declared site. A missing participant requires an authored compatible node, not an invented replacement.
- Project only the observed people, occupancy, brake information and institutional receipts intended for that scene. The advisor receives that projection, not the full population/institution registry.
- Preserve actual loss receipts separately from misleading reports. This extension does not implement the full restricted-artifact investigation system of F06.

Proposed initial validation caps are 64 cohorts, 256 person aliases, 2,048 dead intervals across the whole world, 128 normalized ranges in one allocation, 64 steps in a rail mechanism, 64 institutions and 256 pending events. Keep the current 256-domain-event transaction cap. These are conservative authoring limits requiring benchmarks, not passed performance measurements. Exceeding a cap rejects atomically; no truncation or silent loss of victims is permitted.

A rail contact or mass loss emits bounded aggregate receipts, not one event per anonymous member. Cohort sets and life queries must operate on normalized intervals. No loop from 1 to the world population is acceptable.

## 7. Required implementation and migration tests

Implement the modules behind the edition registry in this order: population normalization/ledger; rail evaluator; principals/institutions; obligation lifecycle; prepared projection and fixtures. Do not migrate the whole content bank at once. Start with small profile-test manifests covering these contracts, then author reviewed new-edition nodes.

The golden suite must include:

1. Both switch routes with exact named survivor sets, opposite physical left/right assignments and a stale duplicate commit.
2. The same loss allocation referenced from local and global paths; identical retry adds zero deaths and conflicting payload rejects.
3. Different physical events hitting the same dead person; overlapping anonymous ranges; mixed named/anonymous global loss; whole-world extinction.
4. Duplicate cohort IDs, initial-population mismatch, alias collisions, invalid ranges, unsafe counts and interval-cap overflow, with atomic rollback.
5. The matched loop table above, including removal, broken brake, a still-present body and a removed body. Geometry-only changes leave the result unchanged.
6. Accessible descriptions distinguishing stopping mechanisms without images, and debrief adaptation language.
7. Transfer, cancellation, failure, unavailable successor and an already-completed duty. Assert exact owner/executor/cause/due identity, not only a final metric.
8. Same-day dissolution versus due fulfillment, two transitions sharing a day, expiry at the boundary, and a denied scheduled transition.
9. Checkpoint export/replay before contact, before dissolution and immediately before the due boundary. Compare complete journal and world hashes.
10. Frozen v2 artifacts replay byte-equivalently through the old registry entry. Unknown/mismatched editions reject; there is no synthetic conversion to new people or owners.
11. Collector replay pins the correct edition, and identical text/options with different rail mechanics or institutional ownership do not share a comparison cell.
12. No new telemetry is emitted before consent; private and imported runs retain existing protections.

## 8. Fixture closure and limits

| Fixture | What this extension can close after implementation/tests | What it does not close |
| --- | --- | --- |
| F01 | Named victim/survivor identity, distinct casualties, overlap deduplication and local/global conservation. Existing atomic persistence plus browser input tests complete the commitment obligation. | Writing this proposal or passing only a ledger unit test does not verify pointer/keyboard integration. |
| F03 | Executable obstruction dependence versus independent braking; removal counterfactuals; geometry-independent outcomes and traceable stopping cause. | The accessible renderer/debrief checks still must run. It does not solve the ethics or reproduce Footbridge embodiment. |
| F04 | Persistent institutional duty identity, real owner transfer, cancellation/failure semantics, dissolved-owner prevention and declared same-day precedence. | It does not implement a general inventory, employment law or arbitrary autonomous task scheduler. |
| F06, partial improvement | Physical casualty identity and distinct loss/report references. | Restricted artifacts, evidence access, report lineage and investigation remain separate work. |
| F07–F09 | Named principals make later scope/operation work possible. | One-action grants, credentials, in-flight operations and safe cancellation remain unimplemented. |
| F11/F13/F14/F15 | Stable entities and causal references provide later attachment points. | Equipment, scoped drills/evaluations, reviewer dependency graphs and a distinct human successor handoff are not supplied here. |

## 9. Collection and interpretation

PersonId and cohort slots identify authored fictional subjects. InstitutionId identifies an authored fictional organization. None is a visitor identifier, account identifier, participant identifier or a real person's demographic record.

The statistical unit stays one opted-in run. Ten runs by one visitor remain ten runs. Do not create one data row per fictional death and call those rows respondents; do not join fictional character appearances to infer real visitor identity. Existing minimal input/advice/exposure transport is sufficient for server replay. Do not upload population ranges or a raw world journal merely because the engine now has them.

Exact comparison context must include the edition/bundle hashes and material prepared mechanism, observation and control context. A matching number of casualties or identical cartoon track is insufficient to pool two moral mechanisms. Named aliases in a scene can themselves change framing; changed identity salience requires a distinct reviewed content context.

Public charts must distinguish authored casualties, simulated people, recorded runs and any future real participant study. A casualty outcome is a consequence of this authored model, not a measurement of the visitor's moral character or an empirical AI-risk probability.
