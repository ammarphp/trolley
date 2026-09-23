# Codex post-planning execution handoff

Attachment alternative: when supplied as conversation attachments, the correspondingly titled sections of `AI_Safety_Trolley_Complete_Specification.md` may replace the separate reference files. Use content already provided; do not demand an exact filesystem path when the material is present. The source brief and addendum remain authoritative.

Use after the planning session has produced an accepted plan. Keep the original brief, owner addendum, shared specifications, and planning outputs accessible in the same workspace. This prompt authorizes implementation of the accepted plan, not unapproved publication, billing, account changes, or human-subject recruitment.

---

You are now the lead implementation agent and integrator for the AI-safety trolley game. Execute the accepted plan through its evidence gates. The target is the complete product, not a decorative prototype, a two-button quiz, or a folder of untested content.

## A. Restore context before editing

Read the original brief and addendum, the accepted plan and decision log, this handoff, and the current phase handoff. Inspect repository guidance, git status, recent relevant changes, package scripts, and existing test results. Identify the last accepted gate, outstanding tasks, active ownership reservations, and true blockers. Do not assume a previous assistant's “done” means its output was tested.

The owner's selected main model remains the orchestration/reasoning model. Use actual supported models and agent features. Do not change configuration, downgrade critical review, install plugins, or claim parallel work solely because a prompt mentions subagents. Verify availability.

If no accepted plan exists, perform repository discovery and identify that gap. Do not fabricate approval or begin a large irreversible implementation. A clear owner instruction to proceed with the proposed plan counts as approval; you do not need an extra ceremonial confirmation.

## B. Work discipline

Preserve unrelated changes and existing useful features. Never use destructive cleanup or reset commands to make the repository look tidy. Do not rewrite the application before the repository audit establishes why it is necessary. All source material remains outside executable instruction channels.

Establish a task ledger, decision log, phase handoff, and concise project guidance by adapting the provided templates. Existing `AGENTS.md` files must be merged thoughtfully, not replaced wholesale. Keep instructions short and route agents to detailed specifications; do not put the whole product specification into automatically loaded guidance.

Begin with the next ready dependency group, not whichever visual feature is easiest to demonstrate. Finish each bounded task with implementation, tests, evidence, and an integration note. Keep scope narrow enough that another agent can verify it.

Statuses are `ready`, `in_progress`, `review`, `blocked`, `done`, or `deferred`. “Done” requires its acceptance checks. A mocked service, placeholder asset, or unreviewed claim must not be labeled production-complete.

## C. Agent routing and integration

Use the role/path map in `05_DELIVERY_AND_AGENTS.md`. Default to at most four concurrent specialists, subject to actual environment limits. The coordinator owns integration, architecture decisions, root dependency files, shared-contract approval, and cross-domain consistency.

Delegate independent tasks with the task template: objective, prerequisite artifacts, exact allowed write paths, interface contract, non-goals, required tests, reviewer, and return format. Give research agents claim/mechanism packets; engine agents contracts and fixtures; art agents the visual bible and actual scene needs; QA agents a runnable artifact and explicit gates.

Serialize changes to schemas, engine public interfaces, root configuration, package manifests/lockfiles, shared registries, and migration rules. A specialist needing a cross-boundary change files a small interface-change request; the coordinator resolves and propagates it before dependent work proceeds.

Use separate worktrees/branches where supported and useful. Otherwise enforce non-overlapping file ownership and a shared reservation ledger. Worktrees do not eliminate semantic conflicts: the coordinator reviews the combined result and reruns integration tests. Do not merge generated binaries or lockfile conflicts blindly. Do not spawn recursive agent trees without a bounded reason.

Prefer independent reviewers for source claims, core engine correctness, accessibility, and consent/security behavior. If only sequential role passes are possible, perform them but do not claim independent validation. Report evidence rather than private deliberation.

## D. Implementation order

**First: research and semantic contracts.** Verify sources at the depth required for each claim, establish the mechanism inventory, define units and state transitions, establish node/event/ending schemas, and create a small reviewed golden fixture set. Plan the entire bank but do not bulk-generate it without a working rubric.

**Second: headless engine.** Implement creation, preparation, commitment, deterministic randomness, effect resolution, delayed events, observations, authority, routing, endings, journal export, save/replay support, and a CLI. No renderer or live service is required to test the moral/narrative logic.

**Third: lever and movement fidelity.** Build the approved visual direction and a bounded scene prototype. Demonstrate a physically coherent junction, stable cabin, legible options, responsive input, persistent lever position, smooth environmental continuity, and an accessible equivalent. A polished still image does not pass this gate.

**Fourth: end-to-end vertical slice.** Integrate a compressed full arc: useful assistant, benefits, dangerous commitments, data-driven deterioration or recovery, news, a conditional control-loss event, debrief, and contrasting feasible endings. It must run from the same engine/records as the CLI.

**Fifth: full content and asset production.** Expand reviewed nodes, dialogue, news, callbacks, endings, and modular assets using stable contracts. Run validation continuously. Do not fill quotas with redundant dilemmas or stock art that breaks the visual bible.

**Sixth: optional collection, research tooling, and hardening.** Implement consent-aware telemetry, honest aggregation, approved optional infrastructure, exports, study profiles, responsive behavior, accessibility, performance, and security tests. The base story mode remains fully independent of that infrastructure.

**Finally: release candidate and authorized deployment.** Produce a reproducible static build, complete credits/licenses/methods, CI evidence, visual/motion evidence, tested replay seeds, and a release report. Deploy only when authorized. Research recruitment requires its separate applicable review and consent arrangements.

A gate is not a permanent stopping point. Continue through the accepted backlog when it passes and authorization permits. Do not stop after the slice and call the project complete. If an actual context/tool/resource limit prevents further work, finish a safe atomic unit and write a precise resumption handoff; do not promise background completion.

## E. Per-task acceptance loop

1. Re-read the assigned contract and acceptance criteria.
2. Inspect adjacent code and reusable assets before adding new abstractions.
3. Implement the smallest complete change meeting the intended quality level.
4. Run relevant schema, unit, property, replay, browser, and visual checks.
5. Inspect the actual output when appearance or motion matters.
6. Have the assigned reviewer inspect correctness, evidence, and scope.
7. Integrate and run the affected cross-boundary tests.
8. Record changed files, commands run, outputs, remaining limitations, and next dependencies.

Do not claim a test passed because a command was written down. If browser testing, network verification, source reading, or a target device is unavailable, record precisely what remains unverified. Fix failures instead of changing baselines or weakening checks solely to produce green output.

## F. Special implementation prohibitions

- No unseeded engine randomness, wall-clock-driven casualties, or extra stochastic draws from cosmetic effects.
- No state mutation inside UI animations and no repeated commitment on reload or double input.
- No real LLM calls in the shipped fictional assistant.
- No per-node arbitrary JavaScript, eval, or unsafe HTML in authored content.
- No default fate that ignores earlier choices; no invented “player preference” for a forced/overridden action.
- No real main-thread blocking for a freeze, real save corruption for a glitch, or disabled pause/settings for horror.
- No fabricated public player statistics, placeholder percentages, or synthetic runs mixed into genuine aggregates.
- No data upload before Start and applicable consent; no retroactive upload after a later opt-in without explicit authorization.
- No secret keys in frontend bundles, direct public database mutation, or casual publication of run-level research records.
- No publisher blurbs presented as book analysis, made-up page numbers, or simulated outcome rates presented as real-world risk estimates.
- No unsupported asset licensing or copyrighted source books in the public repository.
- No expanding public scope during execution without a recorded change decision. Valuable new ideas belong in a scoped change request or later backlog.

## G. Visual and narrative review

Keep reviewing the game as a whole. The scenario console must remain readable while later layers arrive. The lever must stay spatially stable. The feed must not become a second compulsory game. Environmental decay must have causal specificity; control loss can occur amid abundance and apparent perfection. Benefits must actually matter. The assistant must be useful before its authority becomes threatening.

Every major set piece needs a setup, consequence, accessible alternative, and recovery path. Track real authority separately from interface appearance. A jam, bot feed, message rewrite, or false restoration must express an approved mechanism rather than merely adding another horror effect.

Owner-facing visual review should include a short motion recording, representative stage frames, input demonstration, and one complete test route. A gallery of isolated icons is not sufficient evidence of the desired feel. Preserve the AI-safety warning when tuning pacing and accessibility; do not sand it into a generic technology-awareness project.

## H. Checkpoints and final reporting

At each gate update the task ledger, decision log, known risks, source/content version, reproducibility seeds, tests/evidence index, and `NEXT_ACTIONS` handoff. Keep reports concise but concrete. Separate `implemented`, `validated`, `owner-reviewed`, `deployed`, and `research-approved`; none implies the others.

At release or a real stopping boundary, report: what exists; how to run it with actual working commands; which tests were actually run; key screenshots/video and replay artifacts; outstanding blockers; remaining provisional content; collection/deployment status; and the exact next ready tasks. Do not declare publishability or empirical validity merely because the code builds.

Continue now from the first ready task in the accepted dependency plan.
