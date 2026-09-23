> Legacy v1 reference. For the current development implementation, read [METHODOLOGY_V2.md](METHODOLOGY_V2.md). This document does not describe v2 readiness or activation.

# Methodology and interpretation

This is an interactive artwork and an exploratory behavioral dataset. It is not a morality assessment, clinical measure, representative poll, or validated AI-risk model.

## What is being explored

The core catalog separates twelve lines of inquiry: intervention mechanisms, headcount and harm, uncertainty, relationships, responsibility, time, personhood, consent, institutions, incentives, absurd framing, and observation/framing of the experiment itself. Each template names a lens. That lens is an authorial hypothesis about what may matter, not evidence that the template cleanly isolates one variable.

The continuous story adds competition, algorithmic advice, reward hacking, self-improvement, loss of shutdown ability, digital suffering, autonomous weapons, resource acquisition, and replacement of human goals by measurable proxies. Consciousness, forecasts, and causal consequences in a dilemma are stipulations inside the fiction. They are not factual claims about existing AI systems.

## Stimulus and sampling

The first three stops concern coffee, parcels, and property. Stop four introduces the classic switch problem. The story escalates in seven stages and continues after the last. Recent choice history influences later selection. There are no unique endings and no correct path.

In exploration mode, family selection is uniform among eligible families, followed by a uniform template selection within that family. Recently seen templates are avoided until the eligible set is exhausted. Finite parameter choices vary compatible counts, probabilities, and time horizons. Many templates intentionally have fixed numbers.

Left/right button positions are deterministic and counterbalanced by the hash of the scenario ID. The visual track mapping uses the same hash. Every response stores its position and seed. Deterministic counterbalancing is not proof that a realized small sample is balanced.

`play-copy.js` is part of the stimulus: it contains the short text actually shown. The full setup remains an annotation in local exports. Use the engine version **and that version’s display copy** when reconstructing a presentation. Do not assume the full catalog setup was visible verbatim in the minimal game.

## Unit of analysis

The unit is a **run**, not a person. One person can start many runs. There is intentionally no way to link those runs server-side. Repeated observations within a run are dependent. Treating every click as an independent subject would inflate evidence.

Public intervention percentages are decision-weighted: long runs contribute more decisions. Total runs include registered runs with no submitted decision. Private runs and blocked requests are not observed. A long run may be ongoing rather than complete. A short run may reflect boredom, connection loss, interruption, distress, or ordinary departure; no cause can be inferred from length alone.

Skips are stored separately and excluded from intervention percentages. Optional confidence and reasons have missing values by design. Active time excludes hidden tabs, blur, dialogs, and deliberate pauses. It still includes reading speed, distraction, device performance, and accessibility differences. Timing is not a direct measure of moral difficulty.

## Analysis templates

1. **Run summary:** decision/skip counts, proportion of interventions, response-time distribution, maximum depth, and stage sequence. No moral score.
2. **Stage transition:** within-run changes in intervention rate and active time. Describe associations; stage, content, graphics, and prior exposure are confounded.
3. **Theme comparison:** distributions within each family and mode, with run counts and decision counts both shown.
4. **Attrition:** distribution of observed run lengths. Treat recent runs as right-censored when making stronger claims.
5. **Framing comparison:** compare selected template pairs only after checking parameter distributions, run histories, track position, and narrative stage. The playful generator is not a replacement for random assignment in a controlled study.
6. **Data quality:** duplicate IDs, repeated ordinals, impossible timing, unsupported engine versions, missing optional fields, automated sources, and sparse groups.

`scripts/analyze.py` implements descriptive summaries from local exports with the Python standard library. It does not fabricate p-values or causal estimates. For formal work, preregister a separate design, use a suitable sampling plan and ethical review where applicable, and preserve the original stimuli.

## Reading notes

The foundational trolley discussions include Philippa Foot, “The Problem of Abortion and the Doctrine of the Double Effect” (1967), and Judith Jarvis Thomson, “The Trolley Problem” (1985). The artistic AI-safety themes draw on general discussions of specification gaming, instrumental goals, oversight, and competitive pressure. The scenarios are original fictional illustrations, not quotations or empirical case studies.

Useful primary material: [DeepMind on specification gaming](https://deepmind.google/discover/blog/specification-gaming-the-flip-side-of-ai-ingenuity/), [Concrete Problems in AI Safety](https://arxiv.org/abs/1606.06565), and [The Off-Switch Game](https://arxiv.org/abs/1611.08219). These motivate questions; they do not validate the fictional probabilities in the game.
