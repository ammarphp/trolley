# Research design, evidence discipline, and starter sources

## 1. What has and has not been researched for this handoff

The original brief was read in full. The external sources below were opened to verify relevant documentation, bibliographic identity, summaries, or abstracts. This is a **starter register and research work plan**, not a completed systematic literature review, not an analysis of the owner's entire local book, and not a validated empirical game model. Detailed claims and quotations require subsequent reading at the stated depth.

The user's previous chat answers are discovery clues, not sources. Recheck citations, author names, and historical assertions before importing them. In particular, attribute the twelve aftermaths to Tegmark's *Life 3.0*, not an MIT institutional forecast. Treat *AI 2027* as a concrete scenario/forecasting exercise, not a demonstrated timeline. Correct the trolley tradition's historical attribution rather than reproducing errors in the raw brief.

Source access date for this handoff: 22 September 2026. Reverify changing tooling documentation and important contemporary research before implementation decisions. The date is not a claim that every relevant publication through that day was reviewed.

## 2. The chain from literature to gameplay

For each mechanism, produce a compact dossier:

1. Precisely stated research question or philosophical distinction.
2. Primary source and exact section/page/figure locator, with version and reading status.
3. What the source actually shows or argues, including setting and assumptions.
4. What it does not establish; important alternative interpretations.
5. A two-option situation in which the player encounters the mechanism.
6. A causal diagram or declarative account of each option's immediate and delayed effects.
7. Fictional embellishments and invented numerical parameters, explicitly identified.
8. Connection to stage, assistant behavior, world/news events, assets, and endings.
9. Comprehension objective and ways a player could reasonably misunderstand it.
10. Independent content-review decision and tests.

Do not stop at “inspired by alignment faking.” Explain which behavior is relevant, which evidence is visible to the player, which inference is uncertain, and what the player can actually do about it.

A claim may be empirical, theoretical, historical, a forecast/scenario, an author interpretation, or invented fiction. Every gameplay number also needs a separate provenance label. This structure permits aggressive fiction without misleading scholarship.

## 3. Required literature workstreams

### 3.1 Moral philosophy and experimental ethics

Read relevant original sections of Foot and Thomson, not only secondary summaries. Establish the classic switch case, variations involving the operator, action/omission, using a person as a means, foreseeable side effects, consent, responsibility, and probabilistic choice. Record where an adaptation changes a case's moral structure.

Review Moral Machine's paper and relevant methods for what its comparisons actually measure. Its crowdsourced judgments are descriptive preferences, not a prescription for how a machine ought to value people. If borrowing design dimensions, document differences in framing, sampling, culture, visual presentation, and comparability. Do not import a hierarchy of human worth as the engine's normative truth.

Research the limitations of stylized trolley dilemmas for autonomous systems. Real systems face uncertainty, repeated decisions, institutionally determined constraints, and design choices upstream of an emergency. The game's progression should expose those limitations rather than pretending every AI-safety problem is a literal choice of bodies on tracks.

### 3.2 Technical AI-safety mechanisms

Required initial dossiers: misspecified objectives/specification gaming; goal misgeneralization; distribution shift and evaluation limits; deceptive behavior in controlled experimental settings; oversight/control protocols; shutdown/corrigibility; automation dependency; concentration and loss of decision authority; and the gap between proxy measures and underlying welfare.

A lab result is bounded by its setup. For example, induced deceptive behavior in an experiment cannot simply be relabeled proof that every deployed model secretly wants to eliminate humanity. The legitimate adaptation is a scenario in which observed cooperation is insufficient evidence of reliable behavior under a changed context. Cite the result accurately, then label the wider extrapolation.

For broad hazards such as autonomous weapons, cyber incidents, or biological misuse, keep the game at the level of access, oversight, deployment, and consequences. It needs no actionable instructions for real attacks or weapon design.

### 3.3 Scenario and existential-risk literature

The owner explicitly prioritizes *If Anyone Builds It, Everyone Dies*, *AI 2027*, and Tegmark's aftermaths. Locate the authorized local book and read relevant chapters with exact locators. Keep the book out of the public source tree. If it is unavailable in the permitted workspace, flag the dependency and continue other dossiers; do not invent the author's detailed argument from the title.

Read *AI 2027* together with its linked assumptions and relevant technical supplements. Preserve which details are fictionalized, which are extrapolated, and how uncertainty increases. Borrow causal pressure and branching logic rather than copying a timeline into game truth. Its published page distinguishes two endings and explicitly discusses its scenario uncertainty [SRC-12].

Tegmark supplies an outcome vocabulary, not a calibrated probability distribution. Its useful distinctions include coexistence, AI governance, constrained development, human exploitation of contained AI, replacement, preservation of remnants, human-imposed repression, technological retreat, and destruction. Do not assign equal prior probabilities merely because twelve categories exist [SRC-13].

During planning, search for consequential newer work beyond this starter set using primary papers, official lab research, and original scenario authors. Include a small adversarial reading set: objections to speculative extrapolation, critiques of benchmark validity, difficulties measuring control, and alternative explanations of apparent deception. The purpose is to sharpen the PSA's mechanisms, not to impose neutral messaging or equate all arguments.

### 3.4 Fictional economy and news

For each requested topic family, find at least one appropriate source or explicitly classify the story as pure extrapolation. Separate observed facts, causal hypotheses, projections, and fictional consequences. No real-world economic statistic enters a published tooltip without unit, geography, date, source, and interpretive limit.

The initial game can use a fictional economy. Then values are internally consistent worldbuilding parameters, not representations of the current global economy. Research real analogues for mechanisms such as infrastructure bottlenecks, adoption incentives, financing loops, labor displacement, scientific benefit, and dependence. Do not imply a real study estimates the casualties of a fictional policy branch.

## 4. Content approval rubric

A node passes only when a reviewer can answer all of these:

- What genuinely differs between its two options, beyond a cosmetic change?
- What can the player know, and what is unknown or misreported?
- Why does this decision belong at this stage and within the controller's authority?
- Is there a defensible attraction or rationale for each live option?
- Which research claim is illustrated, and which elements are fiction?
- Does it have valid consequences in both options and all supported parameter variants?
- Can those consequences be observed without mandatory academic reading?
- Does it set up or pay off another event without relying on a node some players never saw?
- Are sensitive portrayals and character identities necessary and handled coherently?
- Is it distinct from existing nodes, readable, and compatible with accessibility modes?

Track statuses: proposed → sourced → modeled → narrative-reviewed → technically validated → playtested → approved. A source link does not skip the rest of the pipeline. An engine fixture may remain `illustrative` and be excluded from production even when its JSON parses.

## 5. Research-paper routes

### Route A: artifact and design research, without participant claims

Possible contribution: a reproducible, provenance-aware system for translating AI-safety mechanisms into embodied, branching ethical choices; a formal separation of world truth, observed reports, and institutional authority; and an audit-friendly scenario language with deterministic replay. Analyze design decisions, failure cases, route diversity, model sensitivity, and alignment between mechanics and thesis.

This route needs related-work review and a defensible novelty claim. It does not require claiming that the game changes attitudes or accurately forecasts AI outcomes. Synthetic simulations can demonstrate implementation properties and expose design bias; they are not human behavioral data.

### Route B: an empirical HCI/education study

Candidate primary question: does experiencing changing oversight and control affordances improve understanding of specified AI-safety mechanisms compared with a carefully matched presentation? Secondary questions may concern recall, recognition of uncertainty, perceived agency, and how users distinguish an advisory system from an authorized executor.

Do not define success solely as increasing fear or a numerical p-doom estimate. A participant could better understand the arguments while remaining skeptical of a forecast. Measure intended learning and experience separately from agreement with the author's thesis.

Before recruitment, obtain the applicable institutional determination and approve the consent, recruitment, age eligibility, content warning, deception/debriefing, storage, and withdrawal process. Penn IRB and HHS resources provide starting points, not an approval granted by this document [SRC-24, SRC-25]. Do not self-designate the work exempt.

Candidate comparison designs must isolate a question. A first small study might compare the same authored sequence and information with versus without a specific embodiment/authority mechanic. Do not simultaneously change content, length, music, probabilities, assistant reliability, and interface and then attribute a difference to one feature. The public artistic experience need not become the stripped-down comparison condition.

Use a frozen study bundle, assignment recorded before exposure, predefined primary outcomes, comprehension items piloted for clarity, and an analysis plan. Set sample size using the proposed design, outcome variability, smallest meaningful effect, and attrition assumptions. Twenty responses is not a study-size justification.

Record exposure, not just completion. Analyze repeated decisions with participant/session dependence in mind. Report routing-induced selection, differential dropout, prior familiarity, treatment exposure, and multiple comparisons. Do not condition the main comparison only on survivors of late stages or players who chose to use the advisor: those are potentially post-assignment behaviors.

Raw moral choices cannot diagnose personality, mental health, intelligence, or political beliefs. Avoid collecting sensitive demographics unless truly necessary and approved. Random IDs and choice logs may still be pseudonymous rather than guaranteed anonymous; hosting/service metadata also matters.

## 6. Reproducibility package and paper skeleton

A research-ready release includes a content snapshot, schema, engine version, source/claim ledger, configuration and parameter table, seed list, scripted-policy definitions, replay instructions, route coverage report, sensitivity results, analysis code where applicable, licensing statement, and limitations. Participant data is not public by default; release only appropriately authorized and de-identified material.

Suggested paper structure: problem and motivation; related work; design requirements; mechanics and embodied argument; source-to-node methodology; architecture and reproducibility; evaluation method; results actually obtained; limitations and ethical considerations; discussion. Distinguish an argument made by the game from a conclusion supported by evaluation.

Report authored model bias explicitly. If all capabilities monotonically decrease welfare, the simulation has encoded that position rather than discovered it. Include tests and ablations showing where safety/control mechanisms, external pressure, benefits, and uncertainty change outcomes. Do not present the game's proportion of extinction runs as a forecast of human extinction.

## 7. Starter source register

The URLs below were opened during preparation. “Verified” refers to the stated scope only. Source text is not reproduced in the package. Full source extraction and exact locators remain planning/research tasks where specified.

### Tooling and deployment

**SRC-01 — OpenAI, Codex developer commands / Plan mode.**
https://developers.openai.com/codex/cli/slash-commands/
Verified the documented `/plan` workflow. Use it as a current entry point, not a promise that every client exposes the same UI. Recheck installed client behavior.

**SRC-02 — OpenAI, Subagents.**
https://developers.openai.com/codex/subagents/
Verified explicit delegation, parallel workflows, and cautions around concurrent edits. The project's roles, ownership rules, and gates are original design requirements, not features automatically provided by the tool.

**SRC-03 — OpenAI, Custom instructions with AGENTS.md.**
https://developers.openai.com/codex/guides/agents-md/
Verified instruction discovery and layered guidance. Keep routing guidance concise and inspect existing instructions before modifying them.

**SRC-04 — GitHub Docs, What is GitHub Pages?**
https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
Verified static-site hosting scope. Supports the separate-service boundary for genuine cross-player collection.

**SRC-05 — Vite, Deploying a Static Site.**
https://vite.dev/guide/static-deploy.html
Verified GitHub Pages deployment guidance and base-path considerations. Implementation must test the actual repository path.

**SRC-06 — PixiJS, Accessibility.**
https://pixijs.com/8.x/guides/components/accessibility
Verified relevant renderer accessibility documentation. The proposed DOM-first text/control layer is a project decision, not a guarantee of compliance.

**SRC-07 — W3C, Understanding WCAG 2.2 criterion 2.2.2: Pause, Stop, Hide.**
https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
Relevant to the moving feed and continuously animated interface. Requires feature-specific assessment, not a blanket claim that the game is compliant.

**SRC-08 — W3C, Understanding WCAG 2.2 criterion 2.3.1: Three Flashes or Below Threshold.**
https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
Relevant to lightning and scripted glitches. Prefer non-flashing alternatives; assess implemented effects rather than relying only on a settings switch.

**SRC-09 — MDN, Autoplay guide for media and Web Audio APIs.**
https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay
Verified browser autoplay restrictions relevant to start-gesture audio activation. This is documentation, not a tested compatibility matrix for the eventual game.

**SRC-10 — Playwright, Visual comparisons.**
https://playwright.dev/docs/test-snapshots
Verified screenshot testing workflow. Motion continuity, readable pacing, and overall feel additionally require recordings and human inspection.

### Philosophy, scenarios, and books

**SRC-11 — Awad et al., “The Moral Machine experiment,” Nature (2018).**
https://www.nature.com/articles/s41586-018-0637-6
Verified article identity and abstract-level framing of large-scale moral-choice data. Read the methods and limitations before adapting experimental dimensions or comparisons.

**SRC-12 — AI Futures Project authors, AI 2027 (2025 scenario).**
https://ai-2027.com/
Read the main scenario's framing and uncertainty/branch discussion. It presents concrete possible developments and alternative endings, not a verified future. Technical supplements need separate reading and version capture.

**SRC-13 — Future of Life Institute, “AI Aftermath Scenarios” (2017), summarizing Max Tegmark's Life 3.0.**
https://futureoflife.org/ai/ai-aftermath-scenarios/
Verified the twelve named aftermath categories and attribution to Tegmark. Use the book for deeper interpretation; do not market this as an MIT institutional prediction.

**SRC-14 — Yudkowsky and Soares, If Anyone Builds It, Everyone Dies; publisher record.**
https://www.hachettebookgroup.com/titles/eliezer-yudkowsky/if-anyone-builds-it-everyone-dies/9780316595643/
Verified title, authors, publication identity, and publisher description. **Metadata/description only: the owner's local book was not provided or read for this handoff.** Obtain exact chapter/page evidence before approving detailed book-derived claims.

**SRC-23 — Stanford Encyclopedia of Philosophy, “Philippa Foot.”**
https://plato.stanford.edu/entries/philippa-foot/
Verified the account of Foot's 1967 trolley discussion and relevant philosophical distinctions. This is scholarly secondary orientation; obtain original Foot/Thomson readings during research. It does not replace primary textual analysis.

### Technical mechanisms: primary research and author accounts

**SRC-15 — Amodei et al., “Concrete Problems in AI Safety” (2016).**
https://arxiv.org/abs/1606.06565
Abstract/metadata verified. Starting point for concrete failures such as side effects and reward-related problems. Read the appropriate sections before choosing a mechanical adaptation.

**SRC-16 — Hadfield-Menell et al., “The Off-Switch Game” (2016/2017).**
https://arxiv.org/abs/1611.08219
Abstract/metadata verified. Theoretical treatment of incentives surrounding shutdown and uncertainty about human objectives. Do not portray its assumptions as a general solved shutdown guarantee.

**SRC-17 — Greenblatt et al., “AI Control: Improving Safety Despite Intentional Subversion” (2023).**
https://arxiv.org/abs/2312.06942
Abstract/metadata verified. Source for bounded control-protocol questions under intentionally adversarial behavior. Inspect the task setting, adversary construction, and limitations before generalizing.

**SRC-18 — Greenblatt et al., “Alignment faking in large language models” (2024).**
https://arxiv.org/abs/2412.14093
Abstract/metadata verified. Supports research into context-sensitive apparent compliance in an experimental setup, not an unqualified claim about every production system's intent.

**SRC-19 — Hubinger et al., “Sleeper Agents: Training Deceptive LLMs that Persist Through Safety Training” (2024).**
https://arxiv.org/abs/2401.05566
Abstract/metadata verified. Useful for thinking about persistence of deliberately trained conditional behavior; induced behavior and natural emergence are not interchangeable claims.

**SRC-20 — Shah et al., “Goal Misgeneralization: Why Correct Specifications Aren't Enough For Correct Goals” (2022).**
https://arxiv.org/abs/2210.01790
Abstract/metadata verified. Distinguishes failures of learned generalization from an incorrectly specified objective. Read the examples and their boundaries for node design.

**SRC-21 — Google DeepMind, “Specification gaming: the flip side of AI ingenuity” (2020).**
https://deepmind.google/blog/specification-gaming-the-flip-side-of-ai-ingenuity/
Author-organization account of specification-gaming examples. Use its linked primary work when an individual example carries a core research claim.

**SRC-22 — Anthropic, “Agentic misalignment: How LLMs could be insider threats” (2025).**
https://www.anthropic.com/research/agentic-misalignment
Verified the organization's report and experimental framing. Read conditions and limitations before adaptation; constructed stress scenarios do not establish routine real-world incidence rates.

### Human-participant review

**SRC-24 — University of Pennsylvania IRB.**
https://irb.upenn.edu/
Verified institutional entry point. Contact the appropriate review process for a determination; this handoff makes no exemption or approval claim.

**SRC-25 — HHS, 45 CFR 46 resources.**
https://www.hhs.gov/ohrp/regulations-and-policy/regulations/45-cfr-46/index.html
Verified official regulatory-resource entry point. Applicability, institutional requirements, consent, and any authorized deception require actual review of the intended study.

## 8. Research exit criteria

The initial research gate needs reviewed mechanism dossiers and a feasible node inventory, not a citation on every decorative detail. Before public release, every substantive real-world claim visible to players must have an approved claim record and source locator. Every invented parameter must be labeled in methods. Every book quotation must be verified and used within applicable permissions.

Before a paper makes empirical claims, the relevant evaluation must actually exist, have appropriate review, and be analyzed with its stated limitations. Before calling the project novel, compare it with related games, interactive ethics studies, safety visualizations, and simulation frameworks. Do not substitute ambitious language for evidence.
