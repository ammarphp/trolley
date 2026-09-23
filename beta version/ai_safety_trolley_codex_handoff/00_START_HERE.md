# Start here: Codex handoff package

This package converts the owner's trolley-game brief into a research-first product/technical specification, a dependency-ordered delivery plan, and **two operational prompts**: one for planning and one for execution.

The brief is a foundation, not a ceiling. Planning must actively improve it while preserving the immersive two-option trolley loop and the deliberately dark AI-safety warning. The proposed design adds depth through authority, reversibility, useful assistance, causal memory, and the difference between apparent prosperity and genuine control.

## Recommended use

**1. Put this directory in the actual project workspace**, for example under `planning/ai-safety-trolley/`. Keep `source/user_original_brief.txt` and `source/user_addendum.md` with it. The original brief is included unchanged; no source book or existing repository is included.

**2. Start a Codex planning session with the selected model and read `01_PLAN_MODE_HANDOFF.md`.** In clients that expose the documented command, `/plan` enters planning mode [SRC-01]. The prompt requires repository inspection, research, independent specialist passes where supported, expanded ideation, and an integrated decision-ready plan. It forbids premature application implementation.

A launch instruction can simply be:

```text
Read planning/ai-safety-trolley/01_PLAN_MODE_HANDOFF.md and follow it.
The original brief and my addendum are in that directory's source folder.
Use the companion specifications as a proposed baseline, not a ceiling.
Inspect this repository before making architecture decisions. Remain in plan mode.
```

Adjust that path to where the directory was actually placed. Do not assume a path on the owner's machine from the download filename.

**3. Review the resulting plan's major decisions**, especially the actual repository strategy, selected additions, lever/motion design, scope of initial release, and data-collection profile. The handoff already supplies defaults; the review should not become a questionnaire about every implementation detail.

**4. Move to an implementation-capable session and use `02_EXECUTION_HANDOFF.md` with the accepted plan.** The execution handoff routes work through research/contracts, headless tests, lever fidelity, a full-arc slice, complete content/assets, hardening, and authorized deployment. It includes a resumption procedure so the project can survive multiple sessions.

```text
Read planning/ai-safety-trolley/02_EXECUTION_HANDOFF.md.
The accepted plan is at <actual plan path>.
Execute the next ready dependency group, using bounded specialists where available.
Preserve the product invariants, maintain the task/evidence ledger, and continue
through the accepted gates rather than stopping at an unpolished prototype.
```

Replace the plan-path placeholder with the real accepted output. Do not claim that approval or a saved plan already exists.

## Package map

| File | Purpose |
|---|---|
| [AI_Safety_Trolley_Complete_Specification.md](AI_Safety_Trolley_Complete_Specification.md) | Optional single-file reference combining specifications, detailed task criteria, and worked JSON |
| [01_PLAN_MODE_HANDOFF.md](01_PLAN_MODE_HANDOFF.md) | The first prompt: inspection, research, expanded ideation, specialist routing, and planning deliverables |
| [02_EXECUTION_HANDOFF.md](02_EXECUTION_HANDOFF.md) | The second prompt: implementation discipline, delegation, integration, testing, continuation, and release |
| [03_PRODUCT_SPEC.md](03_PRODUCT_SPEC.md) | Vision, core loop, seven-stage proposal, assistant, world/news, visuals, endings, and product boundaries |
| [04_TECHNICAL_SPEC.md](04_TECHNICAL_SPEC.md) | State/contracts, deterministic engine, routing, observations, rendering, save/replay, collection, and deployment |
| [05_DELIVERY_AND_AGENTS.md](05_DELIVERY_AND_AGENTS.md) | Roles, path ownership, dependency phases, eight gates, tests, task inventory, and risks |
| [06_RESEARCH_SPEC_AND_SOURCES.md](06_RESEARCH_SPEC_AND_SOURCES.md) | Evidence-to-mechanic methodology, research study/artifact routes, and 25 verified starter source entries |
| [07_IDEATION_AND_SCENARIO_SEEDS.md](07_IDEATION_AND_SCENARIO_SEEDS.md) | 36 expansion candidates and 14 schematic scenario seeds, with failure tests and scope discipline |
| [08_REQUIREMENTS_TRACEABILITY.md](08_REQUIREMENTS_TRACEABILITY.md) | 62 owner requirements mapped to source lines, implementation areas, tasks, and gates |
| [backlog/tasks.json](backlog/tasks.json) | 60 structured tasks with owners, dependencies, paths, reviewers, criteria, and release-profile rules |
| [fixtures/README.md](fixtures/README.md) | A worked node/state/decision example and its explicit limitations |
| [templates/AGENTS.template.md](templates/AGENTS.template.md) | Short persistent project guidance to adapt, not overwrite existing instructions with |
| [templates/TASK.template.md](templates/TASK.template.md) | Bounded agent assignment and return contract |
| [templates/PHASE_HANDOFF.template.md](templates/PHASE_HANDOFF.template.md) | Durable status, evidence, decisions, blockers, and next-task handoff |
| [source/user_original_brief.txt](source/user_original_brief.txt) | Unchanged owner brief |
| [source/user_addendum.md](source/user_addendum.md) | Binding expansion/immersion/thesis direction |

## Important defaults, not hidden commitments

The proposed campaign has seven stages, 154 distinct authored nodes, 22–32 choices on a stage-5 route, and 27–43 on a longer route. These are planning/tuning targets, not finished content or required padding. The planner may justify revisions while preserving the brief's variable length, growing bank, early common anchors, and real branch consequences.

The proposed stack is TypeScript/Vite, a DOM interface, and a 2.5D renderer chosen through a bounded spike. It is not permission to discard an existing working stack. No current repository has been inspected for this package.

GitHub Pages hosts the complete playable client; genuine cross-player collection requires an optional separate service or a truthful dated aggregate snapshot [SRC-04]. A non-collecting local story release is possible without misrepresenting collection as implemented. A formal study is a separate release profile with separate review requirements.

The supplied research register identifies useful sources and its actual reading depth. It does not pretend the local Yudkowsky–Soares book was read. Missing book access must be resolved by Codex in the authorized workspace before using detailed book-derived claims. Fictional parameters remain explicitly fictional.

## Read routing for specialists

All specialists receive the owner invariants and their bounded task packet. The coordinator reads the full plan. Research agents concentrate on files 03, 06, 07 and the relevant contracts; engine/architecture agents on 04, 05 and fixtures; narrative on 03, 06, 07; renderer/art/audio on the experience and presentation sections of 03–04; data/security on the real-data and research sections; QA on the gates and the actual implemented artifact. This reduces duplicated research and accidental redesign.

## Validate the handoff

Run:

```text
python validate_handoff.py
```

The validator uses only the Python standard library. It checks the task graph for unknown IDs/cycles, verifies requirements/source references and package-relative links, and checks the sample transition and state hashes. It does not test a game that has not yet been built. `VALIDATION_REPORT.json` records the checks run during package preparation. `MANIFEST.sha256` records package checksums.
