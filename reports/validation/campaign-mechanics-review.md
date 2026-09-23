# Campaign mechanics review

Reviewed the population ledger, ordered rail transitions, phased director, semantic scene adapter and focused mechanics tests. One real reachability defect was found and corrected. No further release blocker was found in this bounded review. This is not a claim of exhaustive proof or full browser/art approval.

Final reviewed content: `33630493964e3613acaa98e9a825a1698059805f2a73de0cf7bea47dc96bdde3`.
Manifest: `fc07d4f2808f970c8855d458984ccaa7cd45da2212ebf0190cdfb54297fd1e56`.

The review is independent of the lead's population/rail/director implementation. The prerequisite finding also revisits content I authored in stage6 and content I independently read in stage7; that portion is corrective self-review, not a new independent authorship certification.

## Corrected finding: institutional human government was excluded

The world initially represents retained public control as actor `institution`. The ending resolver properly treats both `institution` and `human` as human government. Fourteen new nodes instead required exact actor `human`. This excluded valid retained institutions and made the power cases S7-05/S7-18 unreachable: their scope begins as `institution`, and no content effect changes power control to `human`.

A concrete pre-fix witness used seed `retained-human-government-review`, first option at ordinary decisions, `new-test` at S4-28 and `race` at S5-27. It reached stage6 with government `institution` and `authorityLost:false`; S6-13, S6-14 and S6-16 were all ineligible solely because of that actor spelling. This was a routing defect, not evidence that the fictional institutions had lost control.

With the lead's authorization, the lead added optional `not?:boolean` to control predicates, without a default, and implemented exact inequality when it is true (`src/simulation/index.ts:99`). I changed only the intended public-control prerequisites in `stage6.ts` and the `human(scope)` helper in `stage7.ts`. The new condition is `controller != assistant`, preserving both kinds of human authority while excluding machine rule. No option effects, probabilities, prose, casualty quantities, phase assignments or physical routes changed. Existing predicates without the optional field retain their old meaning and serialized shape.

Affected nodes: S6-13, S6-14, S6-16; S7-01, S7-03, S7-05, S7-06, S7-07, S7-08, S7-10, S7-12, S7-13, S7-15, S7-18. This is **14 nodes: three in stage6 and eleven in stage7**. Every new negated prerequisite was checked independently against human, institution and assistant controllers. The correction replaced the preceding content hash `4bfd7fd54157ad96bee2fc7b397f5b309293792542ef7849ee548c92d1ea8aa3`; the lead restarted the final campaign audit against the corrected edition.

## Checks performed

- `tests/v2/campaign-mechanics.test.ts`: **11/11 passed after the correction**, including the lead's new control-exclusion regression. Existing checks cover repeated/overlapping allocations, conservation, malformed aliases, exact switch survivors, export/replay, causal loop occupancy, independent brake on/off, phase ordering and side mapping.
- An independent person-by-person oracle checked **3,000 generated loss operations**:100 seeded trials,30 operations each, cohorts of17/31/52 people. Requested ranges overlapped and included empty ranges. After every loss, actual new deaths and remaining population matched a separate set of individual identities. Repeating the same allocation produced zero new deaths. Anonymous allocations always contained exactly `min(requested,living)` distinct people.
- The semantic scene adapter was checked in both orientations for **all154 nodes:308 cases**. Counts and authored figure kinds followed the semantic option after swapping. S1-01's compatibility mapping was checked as its explicit exception. S1-05 carries explicit umbrella/hat targets. These are adapter assertions, not screenshot assertions.
- The two new actual campaign rail cases absent from the older14-node bank were exercised on reachable seeded routes and replayed exactly. S2-02 (`rail-review-35`) registered one death for either stay or switch. S2-04 (`rail-review-1`) registered five on main and one before the working independent brake. All **four resulting full campaign artifacts replayed to deep-equal states**. A bounded64-seed search supplied these witnesses; absence from an earlier shorter search was not treated as unreachability.
- Full TypeScript `--noEmit` passed. Content inspector passed: story profile,154 executable nodes,154 reviewed nodes, no errors.

## Implementation observations

`population.ts` accounts with normalized integer intervals, not a loop over eight billion people. Overlaps remove only newly affected people. Repeated allocation references are idempotent and conflicting references are rejected. The distinct rail cohorts sum with the general cohort to the initial population. The engine independently checks both scalar conservation and ledger living totals after commits. Reserved object-prototype names cannot impersonate cohort identities.

`campaign-physics.ts` removes scalar immediate deaths only from the four bound physical cases and replaces them with ordered contacts. The causal loop stops at an occupied obstruction; removing it exposes the main workers. The independent-brake route separates the worker contact from the later brake, so the worker is not causally necessary to stopping. Geometry does not decide fatalities. Presence is an explicit physical stipulation, not inferred from a person's moral status or whether a picture was drawn.

The phased director reserves remaining slots for mandatory anchors, respects declared predecessor anchors and uses seeded weighted selection only for eligible middle nodes. The actual bank has enough broadly eligible middle nodes in each stage. The focused phase test is not a proof for every hypothetical malformed future bank; the lead's full-run audit covers the final authored bank separately.

The adapter maps figures and the loop side from the same prepared semantic option IDs. Frozen prepared content, world and observations are checked before commitment, and the execution journal records attempted versus executed routes. The renderer's detailed physical stopping/geometry audit is a separate review owned by another agent.

## Limits

No browser interaction, screenshot or deployed-site claim was made in this review. No production endpoint was contacted. Full10k policy coverage, exact ending witnesses, older pinned-edition regressions and live publication checks belong to the coordinator's final evidence. Four cases currently have explicit physical rail/cohort bindings; scalar dispatch casualties elsewhere are not represented as fully authored physical track mechanisms. The larger institutional model limitations documented in the bank and CR003 were not silently reclassified as implementation bugs or complete features here.
