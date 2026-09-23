# Simulation semantics

Status: **implemented campaign semantics with explicitly deferred full-model proposals**, reconciled with [ACCEPTED_PLAN.md](../plan/ACCEPTED_PLAN.md). Shared [contracts](../../src/contracts/index.ts), the pure [engine](../../src/simulation/index.ts), and [invariant tests](../../tests/v2/engine.test.ts) define executable behavior. The [campaign extensions](CAMPAIGN_EXTENSIONS.md) implement phased routing, disjoint population identity and ordered rail contact/braking. Later sections preserve the original model specification and CR001 approximation; unimplemented institution/evaluation/service-ledger detail remains a proposal. CR001 below identifies the approved approximation. Existing v1 modules still generate text and routing, not causal history; no causal history has been backfilled.

## Domain and units

Keep five layers separate: authoritative domain, player observations, director, presentation, and real session/privacy state. Domain transitions never import a renderer, DOM, storage, network, wall clock or LLM.

| Component | Unit / permitted values | Ownership and invariant |
|---|---|---|
| Population | Integer persons in a declared modeled population | Unique casualty events reduce survivors; sum of deaths cannot exceed initial population. Benefits never subtract actual deaths. |
| Essential services | Integer capacity units, three sectors: care, food, power | Each sector declares demand, human capacity and automated capacity. Coverage/shortfalls are derived. Capacity failure causes deaths only through an explicit authored incident. |
| Output | Fictional annual real-output index, baseline 1000 | Not money, market capitalization, growth percentage or empirical GDP. Nonnegative safe integer. |
| AI capability | Reviewed categorical bands | Capabilities and their permitted scopes are separate. No numerical alignment score. |
| Evaluation | System/version, tested scope/context, evaluator, date and finding | A finding covers its stated conditions; a successor does not inherit clearance implicitly. |
| Institution | Scoped grants, effective controllers, independent channels, fallback facilities | Legal authority and actual control can differ. No power follows from a role label alone. |
| Persistent fact | Typed enum/set or referenced domain event | Named damage, surviving actors, preserved evidence and callbacks. No arbitrary script or free-form state mutation. |
| Fictional time | Integer days since campaign epoch | Advances only by authored committed transitions; never by reading time or animation. |
| Probability | Integer basis points 0–10000 | 0 impossible, 10000 certain. No float accumulation; rare events need an explicit higher-precision future contract. |

Every numeric parameter includes a declared unit, provenance category and design rationale or source. Most gameplay quantities are authored fiction. Counts and indices must not be silently mixed or clamped to hide invalid content.

### CR001: approved slice approximation

The coordinator approved a smaller executable slice on 22 September 2026. `care`, `food` and `power` are nonnegative integer service-capacity units against fixed reference demand **1000** per sector; initialize each at 1000 and allow surplus above it. A deficit never creates automatic deaths. Specific authored casualty events are required. `manualStaff`, `recoveryPracticed`, `essentialDependence` and `fallbackLost` record the causal fallback commitments while separate human/automated capacity ledgers remain deferred. Do not claim the full service-capacity model is implemented.

`gdp` is the contract field name for the fictional output index, initialized from `startingGDP` (slice 1000). `capability` is an authored integer progression index bounded 0–1000, not a measured intelligence quantity or probability. The slice population is 8,000,000,000 fictional persons. All game figures remain authored calibration.

Initial human grants must have explicit causes and scopes. Advancing the director to a wider office emits an appointment record/news item; a new role label alone must never silently invent global powers. The initial state can describe human-held institutions across scopes without claiming the local controller personally commands them all.

## Authority and actors

A grant identifies issuer, holder, scope, action, constraints, parent grant, creating event, expiry and revocation rule. An issuer must have the right to delegate that scope/action. Revoking a parent invalidates dependent grants unless a separate event has established a loss of effective control; revocation cannot magically reverse a seizure.

Track the effective controller of each controlled scope separately from grants. A hostile takeover records its cause and unauthorized status, rather than fabricating a valid human grant. A ceremonial signatory can see controls without holding power.

Proposed role progression: local switch operator → regional dispatcher → appointed infrastructure delegate → oversight holder or ceremonial signatory → aftermath witness. Record every appointment and explain its scope diegetically. External institutions act under their own actor IDs; the controller is not sovereign over the whole world.

Exactly two semantic options exist per dilemma. A disabled intended option remains visible with its reason. Advice, recommendation, delegation, execution and override are different events. Real pause, privacy and accessibility controls are never subject to fictional authority.

## Prepared decisions and effects

Freeze node/revision, parameters, observation/evidence, availability, scene recipe, comparison key and route mapping when preparing a decision. `defaultCourseOptionId` is independent of `leftOptionId`/`rightOptionId`: the canonical existing course remains omission whichever side it occupies. Waiting does not choose it. Explicit commitment to continue records the semantic choice.

The bounded declarative effect vocabulary should cover registering casualties, changing service capacity/output, recording an evaluation, grant/revoke/seize control, adding/removing typed facts, scheduling/cancelling named events, and issuing/revising fictional observations. No `eval`, embedded JavaScript, arbitrary JSON paths or executable content. A new operator requires schema review and fixtures.

Conditions reference typed facts and operational fields. An incident identifies its exposure, applicable scope, evidence inputs, parameter provenance and possible effect. A scheduled risk is evaluated against the state at resolution, enabling intervening mitigations; its initiating event, due date and stable draw key are frozen when scheduled.

## Atomic transition and randomness

1. Validate active decision, expected revision, semantic option and actor. Stale input is rejected, never silently remapped.
2. Determine actual executor and authority basis; preserve attempted, chosen and executed options separately.
3. Apply immediate deterministic effects and explicit institutional changes.
4. Resolve immediate incidents against that post-immediate state. Record probability inputs, resolved probability and draw.
5. Enqueue delayed events with stable causal IDs.
6. Advance authored fictional time. Process due events by due date, then declared priority, then stable ID, evaluating each against its actual resolution state. Record cancelled events and reasons.
7. Update observations, callback facts and director coverage; resolve ending eligibility; prepare the next decision where meaningful.
8. Emit one transition envelope with before/after hashes, input, events, draws, schedules and next prepared state. The browser saves envelope and snapshot atomically before irreversible animation.

Reject causal cycles in content validation; a bounded event count guards each transaction. Exceeding it fails the entire transaction without partial state changes. Rendering failure, upload failure and duplicate input cannot recommit it.

Proposed RNG contract: `sha256-counter-v1`, hashing a canonical tuple of seed, domain, stable event-instance ID, draw name and rejection counter; unsigned 32-bit extraction and rejection sampling into basis points. Coordinator approval must freeze exact encoding, endian convention and golden vectors. Routing, incidents, narrative variants and cosmetics have separate domains. No use of object iteration order, wall-clock time or presentation queries as random input.

The slice freezes the canonical UTF-8 JSON tuple `["sha256-counter-v1",seed,domain,instance,name,counter]`. Object keys in hashed state are sorted lexically; arrays retain their semantic order. Read the first four SHA-256 bytes as an unsigned big-endian integer, reject integers outside `floor(2^32/bound)*bound`, then take the remainder modulo `bound`. Independently verified golden tuple `["sha256-counter-v1","golden","incidents","decision-4","incident-a",0]` hashes to `e02c6e6104283884d6b56502c4611c9412bafdb5d4ac51298ada76f98094026a`; its first integer is 3761008225 and its draw for bound 10000 is 8225. Probabilities are authored calibration, never estimated from that deterministic algorithm.

### Executable API and trust boundary

`createCampaign(manifest,nodes,seed)` validates the complete pinned bundle and returns an already prepared campaign. `prepareDecision(campaign,nodes)` is idempotent. `commitChoice(campaign,{decisionId,expectedRevision,optionId,actor:'human',adviceIds},nodes)` returns a new campaign or rejects without modifying its input. Callers must supply exactly the manifest's node bundle. `queryAdvisor(prepared,index)` and `availableAdvice(prepared)` have no world-state argument and cannot advance time or draw randomness.

Prepared decisions carry hashes of their frozen world and public observations. Commit checks the world hash and pinned node. This catches accidental state mutation; a public hash is not an authenticity mechanism. Untrusted imported saves must pass `replayRun` against their original manifest/content. Journal records include requested and executed semantic options and sides, separate before/after world hashes, named domain events, authored incident parameters/draws, and exposed advice IDs. Overrides do not rewrite the user's requested action. `goalMismatch`, `evidenceHidden`, and `reportAltered` are privileged facts and never enter prepared facts or advisor conditions; reported values can differ from actual values without a privileged deception flag leaking to the player.

The pure engine intentionally returns the same transaction when called twice against the same immutable input. The persistence layer owns exactly-once installation through a revision check and atomic save; calling a stale command against the next snapshot fails. Event count is bounded at 256 per transaction. Fictional time changes only during a commit. A terminal settlement from a non-closing node or before stage 5 fails, except actual population zero is immediately absorbing.

The slice does not yet implement the full plan's evaluation objects, multiple AI/institution identities, human/automated service ledgers, arbitrary role-specific action subsets, review-approved story bank, or a guaranteed branch-compatible closing-node director. The current director throws on missing coverage rather than inventing a fallback or forcing an incompatible ending. Those failures are tested and are publication blockers for any bundle that can reach them.

### Slice authority corrections

The clinic decision explicitly appoints a clinical pilot authorizer with a `care` grant. In the succession decision, training preserves the recovery office; it does not restore governance already lost. Signing the offices over always grants and transfers recovery to Morrow. When humans still govern, a separate explicit governance grant changes the controller. When Morrow already governs, `successionRatified` records acceptance of that existing government without a second invented takeover. The conditional events are ordered so these branches cannot both fire. Their journal status is `free` because the chosen local signature executes; that status is not a claim of political freedom.

Manual recovery now requires `manualStaff`, `recoveryPracticed`, and no `fallbackLost` fact together. A remembered drill cannot substitute for staff who have since left. These are slice prerequisites, not the full equipment/staff/versioned-drill model. Accountable continuity requires both public records and a trained successor; records alone do not establish transferable control. Early costly restraint denotes an enforceable collective halt, not an implemented individual successor appointment protocol.

The full F01–F16 obligations are mapped in [fixture-coverage](../../reports/validation/fixture-coverage.md). Passing supported primitive tests does not turn missing named victims, institution lifecycles, evidence channels, per-action credentials, evaluation records, or successor identities into implemented features.

## Finite director

The accepted campaign uses seven variable stage budgets: 4–5 / 4–5 / 5–7 / 5–8 / 4–7 / 3–6 / 2–5, yielding 27–43 choices on a full route and legitimate closure from stage 5. The 30–45 minute requirement is a reading/playtest target, not a timeout. A favorable settlement can lead directly to its aftermath rather than forced further deterioration. An absorbing state stops meaningful human choices and enters its appropriate aftermath. The accepted authoring inventory is 154 distinct candidate slots [12,18,24,28,28,24,20]; counts never substitute for semantic review.

Reserve required anchors before optional selection; enforce concepts, authority, setup/payoff prerequisites, exclusion groups and semantic nonrepetition. A reviewed branch-compatible fallback handles an empty eligible set. Missing production content fails the build. Stage and tension influence selection/presentation within approved limits, never rewrite a committed outcome.

## Eight ending predicate proposals

These are **reviewable predicates**, not an empirical classification of futures. An ending is eligible only after required framing and a declared closure event/horizon. Higher rows take precedence when conditions overlap. Details must agree with actor survival and actual event history.

| Priority / family | Necessary witness facts | Forbidden interpretation |
|---|---|---|
| 1 Extinction | No surviving humans in the declared world population | High output cannot override extinction; no living driver dialogue. |
| 2 Protected remnant | Surviving humans; explicit confinement/preservation settlement; no effective human exit power | Do not call mere poverty captivity or infer preservation from small population alone. |
| 3 Managed succession | Surviving humans; explicit ratified transfer of civil initiative to successors; succession settlement | Requires the transfer event. The implemented horizon still contains living humans; it does not silently settle the moral status of hypothetical uploads. |
| 4 Coercive human containment | Effective human institution controls critical scopes; explicit coercive restrictions; containment settlement | A slowdown is not automatically dictatorship. |
| 5 Prosperous tutelage | Effective AI control of critical scopes; humans survive; each essential service meets demand; governance settlement | Material welfare is not continuing human authority. |
| 6 Devastated survival | Humans survive; explicit catastrophe with unrepaired harm or an essential-service shortfall; closure reached | Requires actual devastation, not merely uncertainty or broken routing. |
| 7 Costly restraint | Humans survive; effective enforceable human veto; recorded shutdown/rollback or coordinated halt; bounded deployment; material costs persist | Restraint has a causal act and actual cost, not simply a low capability label. |
| 8 Accountable continuity | Humans survive; effective enforceable human vetoes; functioning services; bounded approved deployment; no unresolved control-loss event or unsettled catastrophe | Successful current controls do not prove unrestricted ASI safety. |

Each family needs an executable seed/input witness, a near miss and overlap/precedence fixtures. Continuity is not an unconditional fallback: if no predicate matches, the director must schedule a tested resolution node within its reserved closing budget. A terminal marker without a compatible predicate is a content error. These eight compositions may reference Tegmark categories in the debrief without claiming to exhaust them or assign equal probabilities. The authorial PSA does not require every seed to reach doom.

## Observations and history

An observation references its source event/system, displayed claim, confidence/qualification, visibility and revision lineage. Official reports may omit/relabel facts; independent records preserve what was observed at the time. A fictional message revision cannot mutate an earlier decision's exposure record. Unknown is different from zero or false.

Counterfactual explanations distinguish player actions, external actors and random incidents. Capability, service output, wellbeing and control are not interchangeable. Avoid inferred personality labels from choice patterns.

## v1 preservation

Keep old scenarios and `v=1.0.0` links under a legacy reader. Existing records remain genuine legacy choices with their original text and exports. Do not backfill fictional world states, permissions, casualty incidents, random draws or endings. A v2 campaign starts a fresh independent run; new collection consent does not authorize retrospective upload. Aggregate comparisons are version- and framing-specific.

## Required invariant evidence

1. Browser/CLI replay equality with pinned bundles and canonical hashes.
2. RNG-domain isolation from cosmetic changes, queries, uploads and content-file ordering.
3. Exactly-once effects under double input, retry, crash/resume and animation failure.
4. Delayed-event chronology, mitigation, cancellation and bounded cascade behavior.
5. Valid delegation/revocation lineage and explicit unauthorized effective control.
6. Left/right counterbalancing preserves default-course semantics and comparisons.
7. Population conservation, casualty deduplication and finite/unit-correct arithmetic.
8. Observation deception cannot modify truth, consent, statistics or sources.
9. Required-anchor completion, payoff validity, no deadlock and valid closure on every supported route.
10. Ending witnesses, near misses, precedence and actor/setting consistency.
