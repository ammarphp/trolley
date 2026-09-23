# Methodology — trolley. v2 campaign

The campaign is an authored causal simulation, not a forecast. Its population, economic and capability indices, service capacities, incident probabilities and outcomes are fictional. A paper explaining a failure mechanism does not validate a numeric game parameter. The source explorer separates the two.

## What is implemented and what is proposed

The campaign contains 154 editorial-reviewed decision nodes across seven stages. Each journey selects 27–43 choices; absorbing outcomes can close it earlier. Eight ending predicates distinguish welfare, effective control and recovery. The earlier fourteen-node slice remains available to verify old saves and exports. Service capacities and several institutional facts retain the documented coarse approximation; a larger content bank does not by itself increase model fidelity.

The population ledger partitions fictional people into disjoint indexed cohorts, prevents double-counted deaths and preserves total population. Four matched rail cases execute ordered contact and brake events; their loop, occupancy and independent-brake counterfactuals are implemented explicitly. Other casualties use authored effects allocated among living slots. See [campaign extensions](architecture/CAMPAIGN_EXTENSIONS.md), [editorial review](../reports/validation/campaign-editorial-review.md) and [release evidence](../reports/validation/full-campaign-release.md). The sixteen visual concepts are review mockups, not evidence of final art acceptance.

## Philosophy and AI safety

The classic cases draw on Foot and Thomson. Changing the controller's embodiment changes the case and is identified as an adaptation. Descriptive choices are not moral prescriptions. The assistant is authored dialogue, never a live model; its responses use the information available in the prepared decision. Its expandable Reasoning text is a written in-character assessment. Thinking and streaming are local presentation effects, not live model computation. Fully delivered replies count as advice exposure; a reply cancelled by committing a decision does not. Reduced motion reveals replies immediately.

Technical sources include goal misgeneralization, shutdown incentives, alignment faking, reward hacking and control evaluations. Scenario literature informs possible mechanisms and futures, not calibrated catastrophe rates. The game includes real benefits in its fictional world, effective interventions with costs, and failures of intervention. The intended argument concerns preserving the capacity to make and correct decisions.

## Four evidence layers

1. Published observation, theory or argument, with inspected scope.
2. Authored model and numerical assumptions.
3. Tested software properties, replay and route coverage.
4. Actual participant effects, which require separate evaluation.

Simulation reports describe layer3 under layer2 assumptions. They do not estimate real extinction probabilities. No educational efficacy, attitude change or representative population finding is established by this artifact.

## Run grain and interpretation

A run is an entry, not a person. There is no persistent user ID. One person can contribute multiple runs; independence across people cannot be inferred. Story-mode choices are observational and affected by routing, prior events, optional advice, repeated play and attrition. Compare only approved equivalent contexts and report exposure/missingness. Forced or overridden actions are not preferences. The display threshold of20 runs is not significance or an anonymity guarantee.

New collection is opt-in and starts after Start. The published campaign configuration disables the v2 endpoint until the optional service is operationally verified. The game remains playable without collection. Formal study recruitment and empirical claims require a separate frozen protocol and applicable institutional review.

## Reproducibility

The headless engine pins content and manifest hashes, a versioned seed algorithm and immutable decisions. Its journal records intended and executed actions, actual actors, draws, delays and effects. Replay regenerates and compares the full campaign. Optional advice, motion, time spent reading and network failure do not reroll consequences. Outcome-specific prose selects the first matching guarded receipt after effects, incidents and due delays resolve, using the executed action. These presentation guards do not add effects or randomness. Prior prose editions remain pinned for existing records. Browser saves are replay-checked on resume. Local exports omit the collection capability secret.

See research/ for source dossiers, candidate inventory and explicit reading limitations. See reports/validation/ for actual test evidence; an unrun test script is not a passed check.
