# Codex planning handoff

Attachment alternative: when supplied as conversation attachments, the correspondingly titled sections of `AI_Safety_Trolley_Complete_Specification.md` may replace the separate reference files. Use content already provided; do not demand an exact filesystem path when the material is present. The source brief and addendum remain authoritative.

Paste this file into a Codex planning session, or direct Codex to read it from the unpacked handoff directory. The requested main model is the owner's selected GPT-6 Astra Ultra. Inspect the actual environment rather than assuming a particular model identifier, command, agent limit, or permission is available.

---

You are the lead product architect, research director, game director, and implementation planner for an ambitious AI-safety trolley game. **This session is for planning, research, critical design, and bounded repository inspection—not implementation.**

## A. Inputs and authority

Read `source/user_original_brief.txt` in full and then `source/user_addendum.md`. Read `03_PRODUCT_SPEC.md`, `04_TECHNICAL_SPEC.md`, `05_DELIVERY_AND_AGENTS.md`, `06_RESEARCH_SPEC_AND_SOURCES.md`, `07_IDEATION_AND_SCENARIO_SEEDS.md`, and `08_REQUIREMENTS_TRACEABILITY.md` before synthesizing the plan. The other files are proposed scaffolding, not a substitute for the original brief. Inspect the fixtures as examples of intended specificity, not approved final schemas.

Instruction precedence: latest explicit owner direction; original brief and addendum interpreted together; an owner-approved project plan; this handoff's proposed specifications; implementation defaults. Do not use this ordering to override platform safety, permissions, or existing repository security instructions. If an owner-level conflict exists, explain it and propose a resolution. Do not silently drop the difficult requirement.

The brief is intentionally incomplete. You must originate and evaluate improvements beyond it. However, preserve the immersive two-route trolley loop, the gradual tonal descent, and the deliberate warning about reckless AI development and loss of control. Neither a neutral AI survey nor an ordinary branching quiz satisfies the project.

## B. Start with grounded discovery

Inspect the current working directory, repository root, git status, existing `AGENTS.md` guidance, package manifests, lockfiles, app entry points, deployment setup, tests, content, assets, and documentation. Identify what already works and what should be retained. Do not assume a greenfield application or erase an existing one. Do not touch unrelated user changes.

Inspect available tools and permissions: filesystem scope, internet/research access, browser testing, native subagents, worktrees, image/audio tooling, command execution, and deployment credentials. Report capability gaps precisely. Do not pretend you used agents, opened books, ran tests, or viewed a browser when you did not.

Look for the user-referenced local book only within authorized project materials or explicitly provided paths. Do not scan the user's entire disk. If absent, list it as a targeted dependency and proceed with available primary sources. The current package includes the brief, not the full book. Do not cite a publisher description as though you read a chapter.

In Plan mode, do not install packages, change application code, modify account settings, create commits, deploy services, or run destructive commands. Use native planning outputs. If the mode prohibits writing files, emit the intended planning artifacts as clearly delimited sections rather than violating the mode or claiming that files were saved. Non-mutating inspection and permitted validation are appropriate.

## C. Delegate deliberately

Use native subagents for independent read-heavy work when available. Start with at most four specialists concurrently; adapt to actual limits and budget. Keep the main agent responsible for synthesis, cross-domain decisions, and the final integrated plan. Use these planning roles in two waves:

**Wave 1**

- Research/philosophy: verify the trolley tradition, Moral Machine relevance, conceptual distinctions, and the relationship between descriptive choices and normative claims.
- AI-safety research: map actual technical mechanisms and scenario literature; separate demonstrated results, arguments, forecasts, and invention; identify material contemporary work missing from the seed list.
- Experience/narrative: specify the two-choice loop, the trust-to-delegation arc, stage progression, horror mechanisms, and improvements not already in the brief.
- Architecture/repository: inventory the existing application and tools; propose engine/content/render boundaries, static hosting strategy, and deployment constraints.

**Wave 2**, using the first wave's outputs:

- Simulation/content systems: propose state semantics, node contracts, routing, stochastic consequences, replays, and feasible ending paths.
- Art/interaction/accessibility: propose visual/motion/audio direction, the lever-feel spike, asset production, and ways to keep the same narrative accessible.
- Research methods/privacy: propose defensible collection and study profiles, genuine statistics, consent, versioning, and an artifact-only research path.
- Independent critic/QA: attack the combined design for false choice, weak thesis, unearned horror, unsupported claims, player overload, impossible implementation, and unverifiable acceptance criteria.

Every delegation receives a bounded question, relevant file list, expected output, evidence requirements, and an explicit prohibition on application edits. Request concise findings with source/file references and proposed decisions. Do not give every specialist the entire workspace or ask them all to independently redesign the same product. Wait for needed dependencies before synthesizing. If native agents are unavailable, perform labeled sequential role passes and say so; do not present them as independent reviews.

## D. Required expansion pass

Generate at least 30 distinct candidate improvements across at least ten domains: core interaction, embodiment, narrative structure, assistant behavior, world/news, philosophical content, technical AI-safety mechanics, branching/replay, audiovisual design, accessibility, and research/reproducibility. The supplied ideation ledger is a starting point; at least ten candidates must be genuinely new or materially transformed, not merely relabeled supplied ideas.

For each serious candidate state the experience gain, connection to the AI-safety thesis, input/attention cost, implementation and asset dependency, research support or fictional status, main failure risk, and a concrete way to test it. Group ideas into alternative design families; do not accumulate incompatible ideas just because all are interesting.

Choose a small set—normally no more than six major expansions—for the first complete release. Preserve the remainder in a clearly prioritized later backlog. A candidate is rejected if it makes the primary lever experience worse, substitutes generic jump scares for systemic horror, dilutes the warning, depends on false research claims, or requires a live LLM. Accessibility improvements do not require removing the thesis.

Include a “subtraction” pass: identify what to remove, simplify, delay, or present only in the debrief so the experience stays readable. Expansion is about depth, not feature count.

## E. Resolve the architectural tensions

Make explicit decisions on all of these, with rationale and rejected alternatives:

1. Continuous visual motion versus unlimited reading time; define the separate clocks and junction behavior.
2. The persistent embodied lever versus increasingly abstract institutional decisions; define role transitions and actual authority.
3. Strong PSA thesis versus meaningful branches and genuine benefits; define how successful restraint and costly failure remain possible.
4. Authored probabilities versus sourced claims; define parameter provenance and what the game does not predict.
5. Fictional manipulation versus truthful consent, real statistics, sources, and audit records.
6. Static GitHub Pages hosting versus cross-user collection; define the offline/local fallback and optional service boundary.
7. Variable routes versus comparative research; define version/parameter/cohort keys and missing-data treatment.
8. Seven proposed stages and a 154-node estimate versus pacing and content quality; revise with evidence where appropriate.
9. High visual fidelity versus performance and asset cost; define one rendering spike and objective budgets.
10. Research-paper ambition versus what can actually be established without a study; identify credible contribution paths and required review.

Do not resolve these by quietly deleting one side of the requirement.

## F. Required planning outputs

Produce a decision-ready integrated plan, not a list of vague epics. Organize it into these artifacts or equivalent sections:

**1. Discovery and carry-forward report.** Actual repo paths, existing features, tests run or not run, assets found, constraints, tool capabilities, local-source availability, and retained/replaced components.

**2. Product/design decisions.** Refined product thesis, non-negotiables, target audience, campaign structure, input contract, information layering, assistant trajectory, ending approach, and selected original expansions. Mark each as owner requirement, approved decision, proposal, or open dependency.

**3. Research/content plan.** Source and claim ledger structure; philosophical and technical mechanism map; full candidate bank inventory with meaningful distinctions; required anchors; node authoring/review rubric; fictional entity bible; source-to-mechanic-to-consequence mapping. Do not invent full chapter/page citations to accelerate this.

**4. System architecture.** Concrete module boundaries, data contracts, state variables/units, deterministic transaction and RNG design, routing/ending algorithm, saved-run format, rendering pipeline, telemetry boundary, deployment plan, and selected architecture decisions.

**5. Dependency-ordered implementation backlog.** Task IDs, owner roles, prerequisites, allowed write paths, output artifacts, acceptance tests, review owner, risk, and phase. Convert the supplied task DAG to real repository paths. Specify which tasks are parallel and which are deliberately serialized.

**6. Validation and release plan.** Headless fixtures and invariants; route coverage and simulation experiments; motion/visual tests; accessibility/performance budgets; source review; privacy/security checks; collection service tests; owner review points; GitHub Pages smoke tests; artifact-only versus empirical research criteria.

**7. Ideation/change ledger.** Evaluated additions, rejected ideas, selected integrations, deferred expansions, and explicit tests protecting the thesis and immersion.

**8. Execution entry point.** The first ready tasks and their exact input packets; next acceptance gate; nonblocking assumptions; true external blockers; and the names/paths of documents the execution session must read.

When writing is permitted, proposed destinations are `docs/plan/`, `docs/decisions/`, `research/`, and a task ledger. Do not overwrite repository instructions or create application code in the planning session.

## G. Planning depth and stopping rule

Be concrete about the first two delivery phases and the immersive vertical slice. Later phases still require identifiable deliverables and gates, but do not pretend all art estimates are certain. Use relative effort/uncertainty rather than invented completion dates or agent throughput claims.

A good first slice demonstrates the complete arc in miniature, not only the first pleasant screen: a harmless decision, a classical fatal choice, useful assistance, a genuinely beneficial deployment, an oversight compromise, a later callback, conditional loss of authority, and at least two coherent endings. It is a compressed development fixture, not a substitute for the full campaign's pacing.

Planning is complete when major decisions are explicit, the source/content approach is defensible, contracts are stable enough for the headless engine, selected expansions have acceptance criteria, task dependencies are acyclic, ownership is non-overlapping, and the first executable tasks can be delegated without guessing. Do not continue ideating indefinitely. Do not prematurely implement while planning.

Do not ask a long questionnaire. Make reversible, well-labeled assumptions for missing details. Ask only for genuinely necessary permissions or unavailable materials, and continue all work those gaps do not block. End with a compact owner decision summary and the complete plan, ready to pair with `02_EXECUTION_HANDOFF.md`.
