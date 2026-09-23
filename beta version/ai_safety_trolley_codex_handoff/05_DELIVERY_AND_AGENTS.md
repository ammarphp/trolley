# Delivery roadmap, agent routing, and acceptance gates

## 1. Authority and operating model

The owner is product/thesis authority and approves the major plan, visual direction, public release, spending, and actual study/collection arrangements. The lead Codex agent is the integrator, not an unchecked project owner. Specialist agents produce bounded outputs; none can quietly redefine the thesis, introduce new external services, or invalidate shared contracts.

Use the owner's selected capable model for orchestration and difficult synthesis. Let specialists inherit it unless the real environment supports and justifies another choice. Do not invent model names, pretend unlimited agent concurrency, or hard-code unsupported configuration syntax. Official documentation supports explicit subagent delegation and warns about conflicting concurrent edits; the detailed process here is a project-specific prescription [SRC-02].

Default execution budget: up to four simultaneous specialists plus the coordinator, adjusted downward for actual tool limits or overlapping work. Parallelism is a means of isolating independent work, not a performance claim. Read-heavy discovery and independent reviews parallelize well. Schema changes, shared engine interfaces, root dependency changes, migrations, and final integration are single-writer activities.

## 2. Roles and bounded ownership

| Role | Main responsibility | Typical owned paths | Review responsibility |
|---|---|---|---|
| LEAD | Scope, integration, task ledger, owner decisions | Root setup files; docs/plan; docs/decisions; docs/handoffs | Cross-domain consistency and gate completeness |
| ARCH | State semantics, schemas, public contracts, architecture | packages/contracts; docs/architecture | Engine and service boundaries |
| PHIL | Trolley cases, normative distinctions, conceptual integrity | research/philosophy; philosophy claim shards | Source fidelity and meaningful alternatives |
| AIRES | Technical mechanisms, scenario literature, source registry | research/ai-safety; research/sources; AI claim shards | Empirical/theoretical/fiction distinction |
| NARR | Stages, authored nodes, dialogue/news, entities, endings | packages/content; docs/narrative; content review | Setup/payoff, tone, pacing and thesis |
| ENGINE | Deterministic state, RNG, effects, routing, CLI/replay | packages/engine; scripts/simulation; tests/engine | Numerical and causal correctness |
| UX | Semantic DOM, inputs, text, accessibility, save UI | apps/web/src; interaction docs | Readability and equivalent access |
| RENDER | Scene graph, path motion, visual timeline, world projection | presentation scene/timeline modules | Motion continuity and visual performance |
| ART | Art bible, modular assets, exports, asset manifest | assets; runtime asset exports; asset tools | Style and license consistency |
| AUDIO | Sound design, stems, playback and transitions | presentation audio modules; audio assets/docs | Quiet atmosphere and non-audio equivalents |
| DATA | Real telemetry, aggregation, study profiles, analysis | telemetry package; ingestion service; research/study | Genuine statistics and appropriate inference |
| QA | Tests, invariants, route coverage, browser/visual evidence | test/review/report directories | Independent gate evidence |
| SECOPS | Security, optional-service review, CI/Pages deployment | workflow/security/operations paths | Secrets, data boundaries and release integrity |

This is a role map, not an instruction to run thirteen agents at once. One agent may perform multiple bounded tasks over time. Where the same agent writes and reviews its work, label that self-review and obtain an independent review at the relevant gate.

Nested paths overlap in the table because they describe domains, not live reservations. Before dispatch, assign exact files or non-overlapping subtrees. For example, ART does not modify `assets/audio/` while AUDIO owns it; NARR cannot edit a shared registry that AIRES is integrating. Registry shards and a coordinator-owned merge step prevent accidental races.

## 3. Work packet and return contract

Every dispatched task includes: task ID; objective; why now; prerequisite versions/artifacts; exact read set; exact write set; frozen interfaces; non-goals; source requirements; test commands or test specifications; acceptance criteria; reviewer; and requested output format. Use `templates/TASK.template.md`.

A specialist returns: changed files and commit/diff when available; concise design decisions; evidence and source locators; actual tests and results; blockers; requested cross-boundary changes; and remaining risks. A claim that something “should work” is not a test result. Do not route raw lengthy research dumps into the main context when a structured dossier and links will suffice.

The coordinator validates the packet, reviews the diff, checks interface compatibility, integrates it, runs cross-boundary tests, and updates the ledger. Never merge a claimed completion solely because another agent said it passed.

## 4. Collaboration and context hygiene

Use worktrees/branches when the tool supports them and their isolation is helpful. In a shared checkout, enforce a path-reservation ledger. Never let multiple agents edit a lockfile, runtime schema, or content registry concurrently. An interface change request states the old contract, proposed contract, downstream effects, migration, and tests; implement it before dependent work resumes.

Preserve the original brief and all owner amendments unchanged. Record accepted deviations from this proposed spec. Do not let a later summary accidentally become authoritative over a precise earlier requirement. Short `AGENTS.md` guidance should route to documents rather than replicate them [SRC-03].

At context boundaries create a handoff with current commit, modified files, accepted decisions, last passing gate, exact failing checks, active task reservations, known blockers, and next three ready tasks. Never write “continue improving” as the only next action. Retain reproducibility seeds and command outputs as artifacts rather than memory.

Only actual tool work counts as work performed. Do not promise agents will finish later outside an active execution process. If a session must stop, checkpoint and give a concrete re-entry path.

## 5. Dependency structure and production phases

```text
P0 discovery + divergent planning + accepted decisions
    ↓
P1 source dossiers + state model + contracts + bank/ending plan
    ↓
P2 headless engine + journal + replay + simulation gate
    ↓
P3 approved visual grammar + lever/motion/audio fidelity gate
    ↓
P4 compressed end-to-end vertical slice + owner/playability review
    ↓
P5 full authored content + modular assets + campaign integration
    ↓
P6 collection/study tooling + accessibility/performance/security hardening
    ↓
P7 release candidate + authorized Pages deployment + research artifact
```

Some work can overlap: source research streams; art/interaction planning after the semantic model exists; consent architecture before the collection implementation; CI preparation after the slice. The dependency graph, not the phase label, determines when a task is ready. Do not start large art production before the visual/feel gate, or large content expansion before the slice validates the authoring model.

The two highest-risk early questions are whether the modeled choices produce a coherent, auditable experience and whether the repeated lever/junction action remains compelling. Test both before investing in the full asset library. This sequencing preserves the owner's research-first instruction without postponing proof of immersion until the end.

## 6. Acceptance gates

### G0 — Grounded, accepted plan

Discovery references actual files and capabilities. Owner requirements and addendum are traced. The expansion pass is evaluated rather than simply accumulated. Contracts, source dependencies, architecture choices, and the first task packets are concrete. The task graph is acyclic. Owner approval status is explicit. No application changes or deployment are falsely claimed from Plan mode.

### G1 — Research and semantic foundation

The primary philosophical and AI-safety mechanisms have reviewed dossiers with evidence limits. The full campaign has a candidate bank map and branch/ending logic. World variables have units and explicit authority/observation semantics. Node/event/source/run schemas exist. Sixteen golden fixtures cover certainty, uncertainty, immediate and delayed consequences, observations, delegation, forced actions, and endings.

A missing local book blocks unverified book-derived claims, not unrelated engine scaffolding. No production claim can later be marked verified until its required source is actually read. Research-study review can remain pending while a non-collecting game is built.

### G2 — Headless game is coherent

Run the golden fixtures with both options and verify expected transitions. Test duplicate input, stale revisions, invalid actors, out-of-range probabilities, ledger bounds, due-event ordering, and incompatible endings. Replays reproduce hashes under matching versions. A change to cosmetic content does not alter domain incident draws.

Run at least 10,000 seeded complete simulations across documented synthetic policies and seeds, with a finite step bound. No unresolved routing dead ends, repeated mandatory anchors, invalid world states, or crashes. Every accepted ending has at least one explicit witness trajectory; random sampling alone does not prove reachability. Report route distributions as properties of the authored simulation, never estimates of real AI risk.

### G3 — Repeated physical interaction passes

Demonstrate at least 100 junction transitions across different route sequences without a snap to center, geometry mismatch, vanishing critical asset, or lever reset. Inspect a recording, not only snapshots. Input feedback is immediate and commitment unambiguous. The world can move indefinitely while the player reads without resolving a choice. Pause always works.

Review actual reference-scale art, the stable cabin, mirror, track figures, typography, and late-layer space. Test keyboard, pointer, touch, muted play, and reduced motion. Measure selected desktop/mobile profiles against declared budgets. Owner review of visual direction is a separate status; do not mass-produce assets while the basis remains rejected or unknown.

### G4 — Full-arc vertical slice works

A compressed 12–16-node development campaign demonstrates the ordinary loop, a classical dilemma, useful assistance, a real benefit, a causal oversight compromise, a callback, conditional loss of authority, and at least two coherent contrasting endings. It uses the production engine, data contracts, journal, save, and source/debrief path.

Complete normal, interrupted/resumed, muted, reduced-motion, and optional-service-outage journeys. Inspect whether the warning emerges from play without a mandatory essay. Record actual playtest feedback and changes. Do not invent a participant study to satisfy this gate. The slice is not the full game and does not certify all later content.

### G5 — Content-complete campaign

All accepted stage banks, assistant responses, entity/news templates, ending families, assets, and callbacks are implemented and reviewed. The proposed target is 154 distinct nodes; an approved revision may change it, but reduction cannot be concealed by counting text variants as new dilemmas. Every stage's min/max length and mandatory concepts work across branches. Every ending has executable witness evidence.

Run full journeys to detect tonal repetition, a permanently irrelevant assistant, unreadable technical blocks, and failed setup/payoff. All production-source references resolve. Every simulated numerical effect is traceable to a design assumption or a bounded source. Asset licensing and coverage are complete.

### G6 — Public-release hardening and research integrity

Complete the compatibility, accessibility, memory/performance, save/replay, source, security, privacy, and narrative audit. The actual device/browser matrix is reported; unsupported tests are not called passed. There is no fabricated public aggregate, pre-consent upload, frontend secret, or blocker caused by an optional endpoint.

If collection is included, verify actual denominator construction, idempotency, deletion, rate/size limits, server-side validation, synthetic/test separation, and outage behavior. If it is not deployed, mark it unavailable and ship a correctly labeled local/snapshot profile. A study requires its own frozen bundle and applicable approval, not just a consent checkbox.

### G7 — Authorized release, not merely a build

Produce a clean static production build and test it on the actual GitHub Pages repository base path after authorized deployment. Smoke-test direct routes/reloads, assets, audio fallback, save, source links, endings, and optional-service failure. Version the engine/content/assets together. Provide rollback and operations instructions.

The final report distinguishes implemented, tested, owner-reviewed, deployed, and research-approved. A live game can exist without an approved study. A reproducible artifact can support a paper without proving an educational effect. No unearned “publishable-grade” certification.

## 7. Explicit test matrix

| Area | Required adversarial cases | Required evidence |
|---|---|---|
| Input | Double click; drag cancel; key repeat; pointer+touch duplication; stale decision | Automated tests and observed input recording |
| Randomness | Reload; repeated advisor query; reordered cosmetic assets; invalid seed/version | Golden vectors and replay hashes |
| Causality | Delayed event after institution dissolved; overlapping disasters; contradictory headlines | Transition fixtures and consistency report |
| Routing | Minimum/maximum stage budgets; missing prerequisites; exhausted bank; rare ending | Witness routes, fallback tests, route coverage |
| Authority | Advice; explicit delegation; revoke where permitted; jam; unauthorized override | Attempted-choice/executor record assertions |
| Presentation | 100 turns; long reading; resize; tab hide; freeze; no-flash mode | Motion video, snapshots, responsiveness checks |
| Persistence | Mid-animation close; quota denial; private browsing; corrupted or obsolete save | Recovery and no-duplicate-outcome tests |
| Statistics | n=0/19/20; dissimilar parameters; forced choices; synthetic data; stale snapshot | Denominator fixtures and service tests |
| Privacy/security | Before Start; opt-out; retries after withdrawal; malformed payload; missing endpoint | Network inspection and security review |
| Research | Missing source; invented number beside real citation; unobserved later-stage selection | Claim audit and documented analysis limits |
| Release | Repository subpath; direct reload; network outage; cache/version mismatch | Actual production smoke test and build manifest |

## 8. Proposed task inventory

The machine-readable companion is `backlog/tasks.json`. Every task has an owner, dependencies, proposed paths, output, reviewer, and acceptance requirement. Status is proposed, not executed. Large content tasks must be split into independently reviewed 4–8-node child packets.

### P0

| ID | Deliverable | Owner | Depends on |
|---|---|---|---|
| T001 | Inspect repository, permissions, tools, and existing assets | ARCH | — |
| T002 | Reconcile owner requirements and update traceability | LEAD | T001 |
| T003 | Verify starter sources and plan contemporary research | AIRES | T001 |
| T004 | Run divergent ideation and select coherent additions | NARR | T002, T003 |
| T005 | Decide architecture, service boundary, and rendering spike | ARCH | T001, T002, T004 |
| T006 | Synthesize and obtain acceptance of execution plan | LEAD | T003, T004, T005 |

### P1

| ID | Deliverable | Owner | Depends on |
|---|---|---|---|
| T007 | Create philosophy mechanism dossiers | PHIL | T006 |
| T008 | Create technical AI-safety mechanism dossiers | AIRES | T006 |
| T009 | Read prioritized scenario/book literature and news analogues | AIRES | T006 |
| T010 | Normalize source and claim registry | AIRES | T007, T008, T009 |
| T011 | Specify world units, authority, and causal transitions | ARCH | T007, T008 |
| T012 | Define runtime-validated content and event contracts | ARCH | T010, T011 |
| T013 | Plan stages, anchors, branch families, and full bank inventory | NARR | T007, T008, T011, T012 |
| T014 | Design ending predicates and compatibility rules | NARR | T009, T011, T012 |
| T015 | Author and review 16 golden semantic fixtures | NARR | T010, T012, T013, T014 |
| T016 | Define research profiles, privacy, and evaluation approach | DATA | T006, T011, T013 |

### P2

| ID | Deliverable | Owner | Depends on |
|---|---|---|---|
| T017 | Implement pure engine skeleton and versioned state | ENGINE | T012, T015 |
| T018 | Implement validated effects and atomic commitment | ENGINE | T017 |
| T019 | Implement seeded keyed randomness and event journal | ENGINE | T017 |
| T020 | Implement constrained route director | ENGINE | T018, T019, T013 |
| T021 | Implement delayed events and institutional commitments | ENGINE | T018, T019 |
| T022 | Implement observation and authored advisor selection | ENGINE | T018, T019, T012 |
| T023 | Implement ending resolver and continuation semantics | ENGINE | T020, T021, T014 |
| T024 | Implement CLI, export, replay, and checkpoint format | ENGINE | T020, T021, T022, T023 |
| T025 | Pass headless gate with property and policy simulations | QA | T024 |

### P3

| ID | Deliverable | Owner | Depends on |
|---|---|---|---|
| T026 | Establish art bible and reference scene compositions | ART | T011, T013, T006 |
| T027 | Specify responsive layout and accessible input grammar | UX | T013, T016 |
| T028 | Execute bounded renderer spike and select approach | RENDER | T025, T026, T027 |
| T029 | Implement lever and semantic choice UI | UX | T025, T027 |
| T030 | Integrate continuous junction and presentation timeline | RENDER | T028, T029 |
| T031 | Prototype licensed adaptive audio and silence fallback | AUDIO | T026, T028 |
| T032 | Review and pass lever-feel/motion gate | QA | T030, T031 |

### P4

| ID | Deliverable | Owner | Depends on |
|---|---|---|---|
| T033 | Author compressed full-arc slice content | NARR | T015, T032 |
| T034 | Implement entity bible and causal news composer | NARR | T012, T013, T033 |
| T035 | Build deterministic advisor UI and authority progression | UX | T022, T033 |
| T036 | Integrate environmental, mirror, speed and damage channels | RENDER | T030, T033, T034 |
| T037 | Implement bounded control-loss and glitch set pieces | RENDER | T035, T036 |
| T038 | Implement debrief, glossary, source explorer and summaries | UX | T010, T023, T033 |
| T039 | Implement save/resume and robust local storage behavior | UX | T024, T029 |
| T040 | Playtest and pass integrated vertical-slice gate | QA | T034, T035, T036, T037, T038, T039 |

### P5

| ID | Deliverable | Owner | Depends on |
|---|---|---|---|
| T041 | Expand stages 1–2 in reviewed authoring batches | NARR | T040 |
| T042 | Expand stages 3–4 in reviewed authoring batches | NARR | T040 |
| T043 | Expand stage 5 and early closure paths | NARR | T040 |
| T044 | Expand stages 6–7 and post-catastrophe branches | NARR | T040 |
| T045 | Complete ending composition and narrative callbacks | NARR | T041, T042, T043, T044 |
| T046 | Produce complete modular asset and audio library | ART | T040, T026, T034 |
| T047 | Complete campaign integration and developer content inspector | ENGINE | T041, T042, T043, T044, T045 |
| T048 | Pass content-complete campaign gate | QA | T045, T046, T047 |

### P6

| ID | Deliverable | Owner | Depends on |
|---|---|---|---|
| T049 | Implement real consent boundary and local telemetry adapter | DATA | T016, T024, T039 |
| T050 | Implement optional ingestion API and private storage adapter | DATA | T049, T005 |
| T051 | Implement genuine aggregates and stats display integration | DATA | T050, T038 |
| T052 | Prepare frozen study profile and analysis/reproducibility tools | DATA | T016, T048, T049 |
| T053 | Run responsive, accessibility and performance hardening | QA | T048, T049 |
| T054 | Conduct independent correctness, sources and security audit | SECOPS | T048, T049, T053; profile-specific additions |
| T055 | Run complete narrative and usability playtest review | NARR | T048, T053 |

### P7

| ID | Deliverable | Owner | Depends on |
|---|---|---|---|
| T056 | Prepare Pages build, CI, deployment and rollback workflow | SECOPS | T040, T005 |
| T057 | Complete user, developer, source, license and paper-artifact documentation | LEAD | T048, T055; T052 for formal study |
| T058 | Assemble release candidate and review all gates | QA | T054, T055, T056, T057 |
| T059 | Deploy only the owner-authorized release profile | SECOPS | T058 |
| T060 | Create maintenance and research continuation baseline | LEAD | T059 |

## 9. Blockers, risk register, and change control

| Risk | Early signal | Prevention / response | Accountable role |
|---|---|---|---|
| Thesis diluted into generic education | Abstract exposition replaces consequential oversight choices | Review every stage against the owner invariants; restore mechanical warning | LEAD + NARR |
| Doom hard-coded regardless of actions | Favorable paths only change ending adjectives | Feasible witness paths, causal tests, control/benefit ablations | ENGINE + QA |
| Research veneer | Book titles but no locators; arbitrary numbers appear sourced | Claim ledger, reading-depth status, independent review | AIRES + PHIL |
| Motion fails the game | Snap resets, jitter, unreadable text | Early repeated-junction gate; reject weak renderer before asset scale | RENDER + UX |
| Scope inflation | Simultaneous editor, multiplayer, complex economy, live services | Small selected expansion set; scope change requests | LEAD |
| Asset inconsistency | Many icons, no coherent complete scene | Visual bible and scene-level asset mapping; staged batches | ART |
| Procedural contradiction | Dead people speak; closed labs release models | Preconditions, callback dependencies, compatibility checks | NARR + ENGINE |
| False or contaminated statistics | Forced choices counted; numbers appear before data exists | Eligibility keys, genuine snapshots, separate synthetic namespace | DATA |
| Privacy/approval error | Public study begins before determination; overclaimed anonymity | Non-collecting default; explicit review/service gate | DATA + SECOPS |
| Agent collision | Shared schema/lockfile churn; duplicate research | Scoped packets, single writer, contract changes before parallel work | LEAD |
| Session loss | Next agent cannot reproduce status or tests | Versioned handoff, task ledger, evidence files and seeds | LEAD |
| Unsupported publication claim | “Research paper” is only a game plus bibliography | Related work, explicit contribution and evaluation actually performed | LEAD + research reviewers |

Change requests state the problem, owner requirement affected, proposed improvement, costs/risks, data/asset implications, tests, and approval scope. Minor reversible improvements may be accepted by the coordinator within the plan. Changes to thesis, primary interaction, public data practices, recurring costs, or release scope return to the owner.

Do not create a long sequence of unnecessary approvals. Nonblocking unknowns have labeled defaults. True external dependencies—book access, credentials, institutional review, a real target device, or publication permission—are visible and isolated. Continue independent work rather than disguising a blocker or stopping the whole project.

## 10. Release-profile dependency rule

The task ledger distinguishes `local_story`, `remote_statistics`, and `formal_study`. T050–T051 are required for live remote statistics, not for a deliberately non-collecting local-story release. T052 is a formal-study deliverable. T054 and T057 add their relevant dependencies only for the selected profile. A local release must accurately omit or disable those optional capabilities; it does not mark them complete. All common game, source, accessibility, integrity, and deployment gates still apply. The owner's ultimate full scope remains tracked even when an earlier release deliberately defers a service.
